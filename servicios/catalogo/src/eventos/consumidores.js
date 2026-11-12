export function crearManejadorEventos(repo) {
  return async (evento) => {
    const d = evento.datos;
    if (evento.tipo === "inventario.actualizado") {
      await repo.actualizarStock(d.productoId, { estadoStock: d.estado, stockDisponible: d.disponible });
    } else if (evento.tipo === "vendedor.aprobado") {
      await repo.marcarVendedorActivo(d.vendedorId, true);
    } else if (evento.tipo === "vendedor.suspendido") {
      await repo.marcarVendedorActivo(d.vendedorId, false);
    }
  };
}

export function registrarConsumidores(bus, repo) {
  return bus.consumir({
    cola: "catalogo.eventos",
    claves: ["inventario.actualizado", "vendedor.aprobado", "vendedor.suspendido"],
    manejador: crearManejadorEventos(repo),
    procesados: repo.eventos,
  });
}
