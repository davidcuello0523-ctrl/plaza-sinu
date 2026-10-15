// Dobles de prueba: repositorio en memoria, bus que anota eventos y cliente de vendedores falso.
import { ErrorApp, crearLogger } from "@plaza/compartido";

export function repoEnMemoria(iniciales = []) {
  const datos = new Map(iniciales.map((p) => [p.id, { ...p }]));
  const procesados = new Set();
  return {
    datos,
    // Filtro simplificado: la consulta real de Mongo se prueba aparte (construirConsulta).
    buscar: async (f) => {
      const lista = [...datos.values()].filter((p) => !p.eliminado
        && (f.duenoUsuarioId ? p.vendedorUsuarioId === f.duenoUsuarioId : p.publicado && p.vendedorActivo)
        && (!f.categoria || p.categoria === f.categoria));
      return { datos: lista.slice((f.pagina - 1) * f.porPagina, f.pagina * f.porPagina), total: lista.length };
    },
    buscarPorId: async (id) => datos.get(id) || null,
    buscarPorIds: async (ids) => ids.map((id) => datos.get(id)).filter(Boolean),
    crear: async (d) => { datos.set(d.id, { ...d }); return datos.get(d.id); },
    actualizar: async (id, c) => Object.assign(datos.get(id), c),
    actualizarStock: async (id, c) => { if (datos.has(id)) Object.assign(datos.get(id), c); },
    marcarVendedorActivo: async (vid, activo) => { for (const p of datos.values()) if (p.vendedorId === vid) p.vendedorActivo = activo; },
    contarPorCategoria: async () => [{ _id: "bicicletas", cantidad: 1 }],
    eventos: { existe: async (id) => procesados.has(id), guardar: async (id) => procesados.add(id) },
  };
}

export function busFalso() {
  const publicados = [];
  return { publicados, publicar: (tipo, datos) => publicados.push({ tipo, datos }), estaConectado: () => true };
}

// Vendedores falso: usuarioId → puesto (o error si no existe / servicio caído).
export function clienteVendedores(puestos) {
  return {
    get: async (ruta) => {
      const usuarioId = ruta.split("/").pop();
      const p = puestos[usuarioId];
      if (p === "caido") throw new ErrorApp(503, "SERVICIO_NO_DISPONIBLE", "Vendedores no disponible, intenta en unos segundos");
      if (!p) throw new ErrorApp(404, "NO_ENCONTRADO", "El usuario no tiene puesto");
      return p;
    },
  };
}

export const producto = (extra = {}) => ({
  id: "prd-009", nombre: "Casco MTB ventilado", slug: "casco-mtb-ventilado", descripcion: "", precio: 159000,
  categoria: "bicicletas", atributos: { talla: "M/L" }, imagenes: ["/productos/prd-009/imagen.svg"],
  vendedorId: "v2", vendedorUsuarioId: "u-bicis", nombreTienda: "Rueda Libre", colorTienda: "#2F8F5B", ciudad: "Montería",
  publicado: true, eliminado: false, vendedorActivo: true, estadoStock: "ultimas_unidades", stockDisponible: 2, ...extra,
});

export const logger = crearLogger("pruebas");
