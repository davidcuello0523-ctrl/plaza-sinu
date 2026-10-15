// Dobles de prueba: repositorio en memoria (mismas reglas que el real) y bus falso.
import { randomUUID } from "node:crypto";
import { crearLogger } from "@plaza/compartido";
import { agruparItems, puedeTransicionar, validarAjuste, validarReserva } from "../src/servicios/reglas.js";

export function repoEnMemoria(stocksIniciales = []) {
  const stocks = new Map(stocksIniciales.map((s) => [s.productoId, { reservado: 0, umbral: 3, ...s }]));
  const reservas = new Map();
  const movs = [];
  const eventos = new Set();
  const copia = (x) => structuredClone(x);

  function cerrar(id, destino, motivo) {
    const r = reservas.get(id);
    if (!r) return null;
    if (!puedeTransicionar(r, destino)) return { reserva: copia(r), cambiado: false, stocks: [] };
    const tocados = r.items.map(({ productoId, cantidad }) => {
      const s = stocks.get(productoId);
      if (destino === "CONFIRMADA") s.fisico -= cantidad;
      s.reservado -= cantidad;
      movs.push({ productoId, tipo: destino === "CONFIRMADA" ? "SALIDA" : "LIBERACION", cantidad });
      return copia(s);
    });
    Object.assign(r, { estado: destino, motivoLiberacion: motivo ?? null });
    return { reserva: copia(r), cambiado: true, stocks: tocados };
  }

  return {
    stocks,
    obtener: async (id) => (stocks.has(id) ? copia(stocks.get(id)) : null),
    obtenerVarios: async (ids) => ids.filter((id) => stocks.has(id)).map((id) => copia(stocks.get(id))),
    listar: async (filtro = {}) =>
      [...stocks.values()].filter((s) => !filtro.vendedorUsuarioId || s.vendedorUsuarioId === filtro.vendedorUsuarioId).map(copia),
    movimientos: async (productoId) => movs.filter((m) => m.productoId === productoId),
    ajustar: async (productoId, { fisico, umbral }) => {
      const s = stocks.get(productoId);
      validarAjuste(s, fisico);
      Object.assign(s, { fisico }, umbral !== undefined && { umbral });
      movs.push({ productoId, tipo: "AJUSTE" });
      return copia(s);
    },
    reservar: async ({ pedidoId, items, venceEn }) => {
      const existente = [...reservas.values()].find((r) => r.pedidoId === pedidoId);
      if (existente) return { reserva: copia(existente), nueva: false };
      const agrupados = agruparItems(items);
      validarReserva(stocks, agrupados);
      for (const { productoId, cantidad } of agrupados) stocks.get(productoId).reservado += cantidad;
      const r = { id: randomUUID(), pedidoId, estado: "ACTIVA", venceEn, items: agrupados };
      reservas.set(r.id, r);
      return { reserva: copia(r), nueva: true };
    },
    confirmar: async (id) => cerrar(id, "CONFIRMADA"),
    liberar: async (id, motivo) => cerrar(id, "LIBERADA", motivo),
    reservasVencidas: async (ahora) =>
      [...reservas.values()].filter((r) => r.estado === "ACTIVA" && r.venceEn < ahora).map((r) => r.id),
    registrarProducto: async ({ productoId, vendedorUsuarioId, nombreProducto }) => {
      const s = stocks.get(productoId) ?? { productoId, fisico: 0, reservado: 0, umbral: 3 };
      Object.assign(s, { vendedorUsuarioId, nombreProducto });
      stocks.set(productoId, s);
      return copia(s);
    },
    procesados: { existe: async (id) => eventos.has(id), guardar: async (id) => eventos.add(id) },
  };
}

export function busFalso() {
  const publicados = [];
  return { publicados, publicar: (tipo, datos) => publicados.push({ tipo, datos }), estaConectado: () => true };
}

export const logger = crearLogger("pruebas");

export const VENDEDOR = "00000000-0000-4000-a000-000000000102";
export const stocksDemo = () => [
  { productoId: "prd-009", nombreProducto: "Casco MTB ventilado", vendedorUsuarioId: VENDEDOR, fisico: 2 },
  { productoId: "prd-008", nombreProducto: "Bicicleta MTB rin 29", vendedorUsuarioId: VENDEDOR, fisico: 10 },
  { productoId: "prd-001", nombreProducto: "Portátil", vendedorUsuarioId: "otro", fisico: 5 },
];
