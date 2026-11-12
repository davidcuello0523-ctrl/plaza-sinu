import { randomUUID } from "node:crypto";
import { ErrorApp, ErrorServicioNoDisponible, crearLogger } from "@plaza/compartido";
import { codigoPedido } from "../src/servicios/dominio.js";

const copia = (x) => structuredClone(x);

export function repoEnMemoria() {
  const pedidos = new Map();
  const pasos = [];
  const eventos = new Set();
  let contador = 122;

  const conTodo = (p) => p && copia(p);
  return {
    pedidos, pasos,
    buscarPorIdempotencia: async (clienteId, key) =>
      conTodo([...pedidos.values()].find((p) => p.clienteId === clienteId && p.idempotencyKey === key)),
    siguienteCodigo: async () => codigoPedido(++contador),
    crearPedido: async ({ subpedidos, pasos: nuevos, ...datos }) => {
      if ([...pedidos.values()].some((p) => p.clienteId === datos.clienteId && p.idempotencyKey === datos.idempotencyKey)) {
        throw new ErrorApp(409, "IDEMPOTENCIA", "duplicado");
      }
      const id = datos.id || randomUUID();
      const p = {
        ...datos, id, motivo: datos.motivo ?? null, reservaId: datos.reservaId ?? null, creadoEn: new Date(), pagos: [],
        subpedidos: subpedidos.map((s) => ({ ...s, id: randomUUID(), pedidoId: id, items: s.items.map((i) => ({ ...i, id: randomUUID() })) })),
      };
      pedidos.set(id, p);
      pasos.push(...nuevos.map((x) => ({ ...x, pedidoId: id })));
      return conTodo(p);
    },
    buscarPedido: async (id) => conTodo(pedidos.get(id)),
    listarPedidos: async ({ clienteId, vendedorUsuarioId, estado, pagina, porPagina }) => {
      let lista = [...pedidos.values()]
        .filter((p) => (!clienteId || p.clienteId === clienteId) && (!estado || p.estado === estado))
        .filter((p) => !vendedorUsuarioId || p.subpedidos.some((s) => s.vendedorUsuarioId === vendedorUsuarioId))
        .map(copia);
      if (vendedorUsuarioId) lista = lista.map((p) => ({ ...p, subpedidos: p.subpedidos.filter((s) => s.vendedorUsuarioId === vendedorUsuarioId) }));
      return { datos: lista.slice((pagina - 1) * porPagina, pagina * porPagina), total: lista.length };
    },
    transicionarPedido: async ({ pedidoId, desde, hacia, estadoSubpedidos, motivo, pasos: nuevos = [], pago }) => {
      const p = pedidos.get(pedidoId);
      if (!p || !desde.includes(p.estado)) return false;
      p.estado = hacia;
      if (motivo !== undefined) p.motivo = motivo;
      if (estadoSubpedidos) p.subpedidos.forEach((s) => { s.estado = estadoSubpedidos; });
      if (pago) p.pagos.push({ ...pago, id: randomUUID(), pedidoId, creadoEn: new Date() });
      pasos.push(...nuevos.map((x) => ({ ...x, pedidoId })));
      return true;
    },
    actualizarSubpedido: async ({ subpedidoId, desde, hacia, paso }) => {
      for (const p of pedidos.values()) {
        const s = p.subpedidos.find((x) => x.id === subpedidoId);
        if (s && s.estado === desde) { s.estado = hacia; if (paso) pasos.push(paso); return true; }
      }
      return false;
    },
    agregarPaso: async (paso) => pasos.push(paso),
    listarPasos: async (pedidoId) => pasos.filter((x) => x.pedidoId === pedidoId),
    listarParaMetricas: async () => [...pedidos.values()].map(copia),
    eventos: { existe: async (id) => eventos.has(id), guardar: async (id) => eventos.add(id) },
  };
}

export function busFalso() {
  const publicados = [];
  return { publicados, publicar: (tipo, datos) => publicados.push({ tipo, datos }), estaConectado: () => true };
}

export const CLIENTE = { id: "cli-1", rol: "cliente", nombre: "Laura", email: "laura@x.co" };
export const OTRO_CLIENTE = { id: "cli-2", rol: "cliente", nombre: "Otro", email: "otro@x.co" };
export const VENDEDOR_A = { id: "ven-u-a", rol: "vendedor", nombre: "Tienda A", email: "a@x.co" };
export const VENDEDOR_B = { id: "ven-u-b", rol: "vendedor", nombre: "Tienda B", email: "b@x.co" };
export const ADMIN = { id: "adm", rol: "admin", nombre: "Admin", email: "admin@x.co" };

export const PRODUCTOS = [
  { id: "prd-1", nombre: "Casco MTB", precio: 159000, categoria: "bicicletas", imagen: null, vendedorId: "v-a", vendedorUsuarioId: VENDEDOR_A.id, nombreTienda: "Tienda A", publicado: true, eliminado: false },
  { id: "prd-2", nombre: "Sombrero vueltiao", precio: 420000, categoria: "artesanias", imagen: null, vendedorId: "v-b", vendedorUsuarioId: VENDEDOR_B.id, nombreTienda: "Tienda B", publicado: true, eliminado: false },
];

export function clientesFalsos({ items = [{ productoId: "prd-1", cantidad: 2 }, { productoId: "prd-2", cantidad: 1 }], inventario = "ok" } = {}) {
  const llamadas = { reservas: [], liberadas: [] };
  return {
    llamadas,
    carrito: {
      get: async () => ({
        grupos: [{ items: items.map((i) => ({ ...i, nombre: i.productoId, estadoStock: "disponible" })) }],
        valido: llamadas.carritoValido ?? true,
        avisos: [],
      }),
    },
    catalogo: {
      get: async (ruta) => {
        const ids = new URL(ruta, "http://x").searchParams.get("ids").split(",");
        return { datos: PRODUCTOS.filter((p) => ids.includes(p.id)) };
      },
    },
    inventario: {
      post: async (ruta, cuerpo) => {
        if (ruta.endsWith("/liberar")) { llamadas.liberadas.push(ruta); return { estado: "LIBERADA" }; }
        if (inventario === "caido") throw new ErrorServicioNoDisponible("Inventario no disponible, intenta en unos segundos");
        if (inventario === "sin_stock") {
          throw new ErrorApp(409, "STOCK_INSUFICIENTE", "Solo quedan 1 unidades de Casco MTB", [{ productoId: "prd-1", disponible: 1, solicitado: 2 }]);
        }
        llamadas.reservas.push(cuerpo);
        return { id: `res-${llamadas.reservas.length}`, pedidoId: cuerpo.pedidoId, estado: "ACTIVA", items: cuerpo.items };
      },
    },
  };
}

export const logger = crearLogger("pruebas");
