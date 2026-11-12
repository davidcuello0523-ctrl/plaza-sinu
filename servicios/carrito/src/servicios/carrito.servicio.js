import { ErrorConflicto, ErrorNoEncontrado, ErrorServicioNoDisponible } from "@plaza/compartido";
import { armarCarrito } from "./armado.js";

export function crearServicioCarrito({ repo, clientes }) {
  async function productoPublicado(productoId, ctx) {
    const [p] = await clientes.productos([productoId], ctx);
    if (!p || !p.publicado || p.eliminado) throw new ErrorNoEncontrado("Producto no encontrado o no disponible");
    return p;
  }

  async function verificarStock(producto, cantidad, ctx) {
    const [d] = await clientes.disponibilidad([{ productoId: producto.id, cantidad }], ctx);
    const disponible = d?.disponible ?? 0;
    if (cantidad > disponible) {
      throw new ErrorConflicto(
        disponible === 0 ? `${producto.nombre} está agotado` : `Solo quedan ${disponible} unidades de ${producto.nombre}`,
        "STOCK_INSUFICIENTE",
        [{ productoId: producto.id, disponible, solicitado: cantidad }],
      );
    }
  }

  async function ver(usuarioId, ctx) {
    const { items, actualizadoEn } = await repo.obtener(usuarioId);
    if (!items.length) return armarCarrito({ items, productos: [], disponibilidad: [], actualizadoEn });
    const productos = await clientes.productos(items.map((i) => i.productoId), ctx);
    let disponibilidad = null;
    try {
      disponibilidad = await clientes.disponibilidad(items.map(({ productoId, cantidad }) => ({ productoId, cantidad })), ctx);
    } catch (err) {
      if (!(err instanceof ErrorServicioNoDisponible)) throw err;
    }
    return armarCarrito({ items, productos, disponibilidad, actualizadoEn });
  }

  async function buscarItem(usuarioId, productoId) {
    const { items } = await repo.obtener(usuarioId);
    const item = items.find((i) => i.productoId === productoId);
    if (!item) throw new ErrorNoEncontrado("Ese producto no está en tu carrito");
    return { items, item };
  }

  return {
    ver,

    async agregar(usuarioId, { productoId, cantidad }, ctx) {
      const producto = await productoPublicado(productoId, ctx);
      const { items } = await repo.obtener(usuarioId);
      const existente = items.find((i) => i.productoId === productoId);
      await verificarStock(producto, (existente?.cantidad ?? 0) + cantidad, ctx);
      if (existente) {
        existente.cantidad += cantidad;
        existente.precioAlAgregar = producto.precio;
      } else {
        items.push({ productoId, cantidad, precioAlAgregar: producto.precio, agregadoEn: new Date().toISOString() });
      }
      await repo.guardar(usuarioId, items);
      return ver(usuarioId, ctx);
    },

    async cambiarCantidad(usuarioId, productoId, cantidad, ctx) {
      const { items, item } = await buscarItem(usuarioId, productoId);
      await verificarStock(await productoPublicado(productoId, ctx), cantidad, ctx);
      item.cantidad = cantidad;
      await repo.guardar(usuarioId, items);
      return ver(usuarioId, ctx);
    },

    async quitar(usuarioId, productoId, ctx) {
      const { items } = await buscarItem(usuarioId, productoId);
      await repo.guardar(usuarioId, items.filter((i) => i.productoId !== productoId));
      return ver(usuarioId, ctx);
    },

    vaciar: (usuarioId) => repo.eliminar(usuarioId),
  };
}
