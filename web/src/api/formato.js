const cop = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });

export const pesos = (valor) => `$ ${cop.format(Math.round(Number(valor) || 0))}`;

export const fechaHora = (iso) =>
  new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const hora = (iso) =>
  new Date(iso).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function hace(iso) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace un momento";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return `hace ${Math.round(s / 86400)} d`;
}

export const ESTADOS_PEDIDO = {
  PENDIENTE_PAGO: { texto: "Pendiente de pago", tono: "aviso" },
  PAGADO: { texto: "Pagado", tono: "exito" },
  PAGO_RECHAZADO: { texto: "Pago rechazado", tono: "error" },
  RECHAZADO_SIN_STOCK: { texto: "Sin stock", tono: "error" },
  CANCELADO: { texto: "Cancelado", tono: "neutro" },
  COMPLETADO: { texto: "Completado", tono: "exito" },
  PREPARANDO: { texto: "Preparando", tono: "rio" },
  ENVIADO: { texto: "En camino", tono: "rio" },
  ENTREGADO: { texto: "Entregado", tono: "exito" },
};

export const ESTADOS_STOCK = {
  disponible: { texto: "Disponible", tono: "exito" },
  ultimas_unidades: { texto: "Últimas unidades", tono: "aviso" },
  agotado: { texto: "Agotado", tono: "error" },
};

export const CIUDADES = ["Todas", "Montería", "Cereté", "Lorica", "Sahagún", "Tierralta", "San Pelayo"];
