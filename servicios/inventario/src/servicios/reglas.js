import { ErrorConflicto, ErrorValidacion } from "@plaza/compartido";

export const disponible = (s) => s.fisico - s.reservado;

export function estadoStock(s) {
  const d = disponible(s);
  if (d <= 0) return "agotado";
  if (d <= s.umbral) return "ultimas_unidades";
  return "disponible";
}

export const vista = (s) => ({
  productoId: s.productoId,
  nombreProducto: s.nombreProducto ?? null,
  fisico: s.fisico,
  reservado: s.reservado,
  disponible: disponible(s),
  umbral: s.umbral,
  estado: estadoStock(s),
  stockBajo: disponible(s) <= s.umbral,
});

const nombre = (s, productoId) => s?.nombreProducto || productoId;

export function validarReserva(stocks, items) {
  const faltantes = items
    .map(({ productoId, cantidad }) => {
      const s = stocks.get(productoId);
      return { productoId, nombreProducto: nombre(s, productoId), disponible: s ? Math.max(0, disponible(s)) : 0, solicitado: cantidad };
    })
    .filter((f) => f.disponible < f.solicitado);
  if (faltantes.length) {
    const f = faltantes[0];
    const mensaje = f.disponible === 0
      ? `${f.nombreProducto} está agotado`
      : `Solo quedan ${f.disponible} ${f.disponible === 1 ? "unidad" : "unidades"} de ${f.nombreProducto}`;
    throw new ErrorConflicto(mensaje, "STOCK_INSUFICIENTE", faltantes);
  }
}

export function validarAjuste(stock, fisico) {
  if (fisico < stock.reservado) {
    throw new ErrorValidacion(
      [{ campo: "fisico", mensaje: `Hay ${stock.reservado} unidades reservadas en pedidos sin pagar` }],
      "El stock no puede quedar por debajo de lo reservado",
    );
  }
}

export function puedeTransicionar(reserva, destino) {
  if (reserva.estado === destino) return false;
  if (reserva.estado !== "ACTIVA") {
    throw new ErrorConflicto(`La reserva ya está ${reserva.estado.toLowerCase()}`, "RESERVA_CERRADA");
  }
  return true;
}

export function agruparItems(items) {
  const m = new Map();
  for (const { productoId, cantidad } of items) m.set(productoId, (m.get(productoId) || 0) + cantidad);
  return [...m].map(([productoId, cantidad]) => ({ productoId, cantidad }));
}
