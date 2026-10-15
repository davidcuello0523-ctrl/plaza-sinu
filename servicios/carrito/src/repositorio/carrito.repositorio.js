// Capa de acceso a datos (Redis). El carrito es estado efímero: un JSON por
// cliente con TTL de 7 días que se renueva en cada escritura.
const TTL_SEGUNDOS = 7 * 24 * 3600;
const clave = (usuarioId) => `carrito:${usuarioId}`;

export function crearRepositorioCarrito(redis) {
  return {
    async obtener(usuarioId) {
      const json = await redis.get(clave(usuarioId));
      return json ? JSON.parse(json) : { items: [], actualizadoEn: null };
    },
    async guardar(usuarioId, items) {
      const carrito = { items, actualizadoEn: new Date().toISOString() };
      await redis.set(clave(usuarioId), JSON.stringify(carrito), "EX", TTL_SEGUNDOS);
      return carrito;
    },
    eliminar: (usuarioId) => redis.del(clave(usuarioId)),

    // Ids de eventos ya procesados (idempotencia de consumidores).
    eventoProcesado: async (id) => (await redis.exists(`evento:procesado:${id}`)) === 1,
    marcarEvento: (id) => redis.set(`evento:procesado:${id}`, "1", "EX", TTL_SEGUNDOS),
  };
}
