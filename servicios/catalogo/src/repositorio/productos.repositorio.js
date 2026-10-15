// Capa de acceso a datos (Mongoose). Es la ÚNICA que conoce MongoDB.
import { EventoProcesado, Producto } from "../modelos/producto.modelo.js";

// Mongo usa _id; la API expone "id".
export const aDto = (doc) => {
  if (!doc) return null;
  const { _id, ...resto } = doc;
  return { id: _id, ...resto };
};

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// "monteria" debe encontrar "Montería": cada vocal acepta su versión con tilde.
const sinTildes = (s) => escapar(s)
  .replace(/[aá]/gi, "[aá]").replace(/[eé]/gi, "[eé]").replace(/[ií]/gi, "[ií]")
  .replace(/[oó]/gi, "[oó]").replace(/[uúü]/gi, "[uúü]").replace(/[nñ]/gi, "[nñ]");

const ORDENES = {
  recientes: { creadoEn: -1 },
  precio_asc: { precio: 1 },
  precio_desc: { precio: -1 },
  nombre: { nombre: 1 },
};

// Traduce los filtros de la API a una consulta de Mongo (función pura: se prueba sola).
export function construirConsulta(f) {
  const consulta = { eliminado: false };
  if (f.duenoUsuarioId) consulta.vendedorUsuarioId = f.duenoUsuarioId; // "mis productos": incluye ocultos
  else Object.assign(consulta, { publicado: true, vendedorActivo: true });
  if (f.categoria) consulta.categoria = f.categoria;
  if (f.vendedor) consulta.vendedorId = f.vendedor;
  if (f.precioMin != null || f.precioMax != null) {
    consulta.precio = {};
    if (f.precioMin != null) consulta.precio.$gte = f.precioMin;
    if (f.precioMax != null) consulta.precio.$lte = f.precioMax;
  }
  if (f.soloDisponibles) consulta.estadoStock = { $ne: "agotado" };
  if (f.estadoStock) consulta.estadoStock = f.estadoStock;
  if (f.q) {
    const patron = new RegExp(sinTildes(f.q.trim()), "i");
    consulta.$or = [{ nombre: patron }, { descripcion: patron }, { nombreTienda: patron }];
  }
  return { consulta, orden: { ...(ORDENES[f.orden] || ORDENES.recientes), _id: 1 } };
}

export function crearRepositorioProductos() {
  return {
    async buscar(filtros) {
      const { consulta, orden } = construirConsulta(filtros);
      const [docs, total] = await Promise.all([
        Producto.find(consulta).sort(orden).skip((filtros.pagina - 1) * filtros.porPagina).limit(filtros.porPagina).lean(),
        Producto.countDocuments(consulta),
      ]);
      return { datos: docs.map(aDto), total };
    },
    buscarPorId: async (id) => aDto(await Producto.findById(id).lean()),
    buscarPorIds: async (ids) => (await Producto.find({ _id: { $in: ids } }).lean()).map(aDto),
    crear: async (datos) => aDto((await Producto.create({ _id: datos.id, ...datos })).toObject()),
    actualizar: async (id, cambios) => aDto(await Producto.findByIdAndUpdate(id, cambios, { new: true }).lean()),
    actualizarStock: (productoId, { estadoStock, stockDisponible }) =>
      Producto.updateOne({ _id: productoId }, { estadoStock, stockDisponible }),
    marcarVendedorActivo: (vendedorId, vendedorActivo) => Producto.updateMany({ vendedorId }, { vendedorActivo }),
    contarPorCategoria: () =>
      Producto.aggregate([
        { $match: { publicado: true, eliminado: false, vendedorActivo: true } },
        { $group: { _id: "$categoria", cantidad: { $sum: 1 } } },
      ]),
    eventos: {
      existe: async (id) => Boolean(await EventoProcesado.exists({ _id: id })),
      guardar: (id, tipo) => EventoProcesado.create({ _id: id, tipo }),
    },
  };
}
