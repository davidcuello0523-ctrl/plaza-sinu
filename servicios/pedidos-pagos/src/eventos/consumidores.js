// Consumidores: los pasos ASÍNCRONOS de la saga (inventario confirmó o liberó
// la reserva, notificaciones avisó) se agregan a la traza del pedido.

export function registrarConsumidores({ bus, servicio, repo }) {
  const manejadores = {
    "reserva.confirmada": servicio.alConfirmarReserva,
    "reserva.liberada": servicio.alLiberarReserva,
    "notificacion.enviada": servicio.alEnviarNotificacion,
  };
  return bus.consumir({
    cola: "pedidos.traza",
    claves: Object.keys(manejadores),
    procesados: repo.eventos, // idempotencia: un evento repetido no duplica pasos
    manejador: (evento) => manejadores[evento.tipo]?.(evento),
  });
}
