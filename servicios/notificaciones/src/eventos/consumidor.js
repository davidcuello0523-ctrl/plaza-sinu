// Suscripción a RabbitMQ. La cola "notificaciones.eventos" es durable: si este
// servicio se detiene, los eventos se acumulan y se procesan al volver.
import { TIPOS_CONSUMIDOS } from "../mensajes.js";

export function suscribirConsumidor({ bus, servicio, repo }) {
  return bus.consumir({
    cola: "notificaciones.eventos",
    claves: TIPOS_CONSUMIDOS,
    manejador: (evento) => servicio.procesarEvento(evento),
    procesados: repo.procesados,
  });
}
