export const formatoCOP = (n) => `$ ${Math.round(n).toLocaleString("es-CO")}`;

export function armarCarrito({ items, productos, disponibilidad, actualizadoEn = null }) {
  const porId = new Map(productos.map((p) => [p.id, p]));
  const stockPorId = disponibilidad && new Map(disponibilidad.map((d) => [d.productoId, d]));
  const grupos = new Map();
  const avisos = [];
  let valido = true;

  for (const item of items) {
    const p = porId.get(item.productoId);
    const nombre = p?.nombre || item.productoId;
    const precio = p?.precio ?? item.precioAlAgregar;
    const linea = {
      productoId: item.productoId,
      nombre,
      imagen: p?.imagen,
      categoria: p?.categoria,
      precio,
      precioAlAgregar: item.precioAlAgregar,
      cantidad: item.cantidad,
      subtotal: precio * item.cantidad,
      disponible: null,
      estadoStock: "desconocido",
      avisos: [],
    };

    if (!p || !p.publicado || p.eliminado) {
      linea.avisos.push(`${nombre} ya no está disponible`);
      linea.disponible = 0;
      linea.estadoStock = "agotado";
      valido = false;
    } else {
      if (precio !== item.precioAlAgregar) {
        linea.avisos.push(`El precio de ${nombre} cambió de ${formatoCOP(item.precioAlAgregar)} a ${formatoCOP(precio)}`);
      }
      if (stockPorId) {
        const d = stockPorId.get(item.productoId);
        linea.disponible = d?.disponible ?? 0;
        linea.estadoStock = d?.estado ?? "agotado";
        if (linea.disponible === 0) {
          linea.avisos.push(`${nombre} está agotado`);
          valido = false;
        } else if (item.cantidad > linea.disponible) {
          linea.avisos.push(`Solo quedan ${linea.disponible} unidades de ${nombre}`);
          valido = false;
        }
      }
    }
    avisos.push(...linea.avisos);

    const vendedorId = p?.vendedorId ?? "desconocido";
    if (!grupos.has(vendedorId)) {
      grupos.set(vendedorId, {
        vendedorId,
        vendedorUsuarioId: p?.vendedorUsuarioId,
        nombreTienda: p?.nombreTienda ?? "Tienda no disponible",
        colorTienda: p?.colorTienda,
        items: [],
        subtotal: 0,
        unidades: 0,
      });
    }
    const g = grupos.get(vendedorId);
    g.items.push(linea);
    g.subtotal += linea.subtotal;
    g.unidades += linea.cantidad;
  }

  if (items.length && !stockPorId) {
    avisos.push("No pudimos verificar el stock en este momento");
    valido = false;
  }

  const lista = [...grupos.values()];
  return {
    grupos: lista,
    total: lista.reduce((s, g) => s + g.subtotal, 0),
    unidades: lista.reduce((s, g) => s + g.unidades, 0),
    avisos,
    valido,
    actualizadoEn,
  };
}
