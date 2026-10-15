// Consumidor de eventos del carrito.
// pago.aprobado → vaciar el carrito del cliente. Por eso el carrito se vacía
// SOLO cuando el pago se aprueba: si se rechaza, el cliente puede reintentar.
export function registrarConsumidores({ bus, repo }) {
  return bus.consumir({
    cola: "carrito.eventos",
    claves: ["pago.aprobado"],
    // Borrar un carrito dos veces es idempotente por naturaleza; igual guardamos
    // los ids procesados para seguir la misma convención que los demás servicios.
    procesados: { existe: repo.eventoProcesado, guardar: repo.marcarEvento },
    manejador: async (evento) => {
      await repo.eliminar(evento.datos.clienteId);
    },
  });
}
