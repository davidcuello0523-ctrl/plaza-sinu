export function registrarConsumidores({ bus, repo }) {
  return bus.consumir({
    cola: "carrito.eventos",
    claves: ["pago.aprobado"],
    procesados: { existe: repo.eventoProcesado, guardar: repo.marcarEvento },
    manejador: async (evento) => {
      await repo.eliminar(evento.datos.clienteId);
    },
  });
}
