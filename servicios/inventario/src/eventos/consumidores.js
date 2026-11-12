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
        if (err instanceof ErrorApp && err.status < 500) {
          logger.warn({ correlationId, evento: tipo, err: err.message }, "evento no aplicable, se descarta");
          return;
        }
        throw err;
      }
    },
  });
}
