export function registrarConsumidores({ bus, servicio, repo }) {
  const manejadores = {
    "reserva.confirmada": servicio.alConfirmarReserva,
    "reserva.liberada": servicio.alLiberarReserva,
    "notificacion.enviada": servicio.alEnviarNotificacion,
  };
  return bus.consumir({
    cola: "pedidos.traza",
    claves: Object.keys(manejadores),
    procesados: repo.eventos,
    manejador: (evento) => manejadores[evento.tipo]?.(evento),
  });
}
