// Consumidores de eventos de inventario (cola durable "inventario.eventos").
// pago.aprobado → confirmar reserva · pago.rechazado → liberar (compensación de la saga)
// producto.publicado → crear registro de stock en 0.
import { ErrorApp } from "@plaza/compartido";

export function registrarConsumidores({ bus, servicio, repo, logger }) {
  return bus.consumir({
    cola: "inventario.eventos",
    claves: ["pago.aprobado", "pago.rechazado", "producto.publicado"],
    procesados: repo.procesados,
    manejador: async ({ tipo, datos, correlationId }) => {
      const ctx = { correlationId };
      try {
        if (tipo === "pago.aprobado" && datos.reservaId) await servicio.confirmar(datos.reservaId, ctx);
        if (tipo === "pago.rechazado" && datos.reservaId) await servicio.liberar(datos.reservaId, "pago_rechazado", ctx);
        if (tipo === "producto.publicado") {
          await servicio.registrarProducto({
            productoId: datos.productoId, vendedorUsuarioId: datos.vendedorUsuarioId, nombreProducto: datos.nombre,
          });
        }
      } catch (err) {
        // Un 4xx (reserva inexistente o ya cerrada) no se arregla reintentando: se registra y se descarta.
        if (err instanceof ErrorApp && err.status < 500) {
          logger.warn({ correlationId, evento: tipo, err: err.message }, "evento no aplicable, se descarta");
          return;
        }
        throw err; // error técnico → reintento y luego DLQ
      }
    },
  });
}
