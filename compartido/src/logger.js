// Logger JSON (pino). Cada línea lleva el nombre del servicio; los middlewares
// añaden correlationId y usuarioId para poder seguir UNA compra entre servicios.
import pino from "pino";

export function crearLogger(servicio) {
  return pino({
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "test" ? "silent" : "info"),
    base: { servicio },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (nivel) => ({ nivel }) },
  });
}
