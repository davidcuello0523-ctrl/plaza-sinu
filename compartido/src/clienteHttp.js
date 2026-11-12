import { ErrorApp, ErrorServicioNoDisponible } from "./errores.js";

const NOMBRES = {
  usuarios: "Usuarios", vendedores: "Vendedores", catalogo: "Catálogo", inventario: "Inventario",
  carrito: "Carrito", "pedidos-pagos": "Pedidos y pagos", notificaciones: "Notificaciones",
};
const nombreLegible = (s) => NOMBRES[s] || s;
const SIN_REINTENTO = new Set(["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED"]);

export const contexto = (req) => ({
  correlationId: req.correlationId,
  authorization: req.headers?.authorization,
});

export function crearClienteHttp({ servicio, urlBase, timeoutMs = 3000 }) {
  const noDisponible = () =>
    new ErrorServicioNoDisponible(`${nombreLegible(servicio)} no disponible, intenta en unos segundos`);

  async function pedir(metodo, ruta, { cuerpo, ctx = {}, intentos } = {}) {
    const maxIntentos = intentos ?? (metodo === "GET" ? 2 : 1);
    for (let intento = 1; intento <= maxIntentos; intento++) {
      let res;
      try {
        res = await fetch(urlBase + ruta, {
          method: metodo,
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            "content-type": "application/json",
            "x-clave-interna": process.env.CLAVE_INTERNA || "clave-interna-dev",
            ...(ctx.correlationId && { "x-correlation-id": ctx.correlationId }),
            ...(ctx.authorization && { authorization: ctx.authorization }),
          },
          body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
        });
      } catch (err) {
        if (intento < maxIntentos && !SIN_REINTENTO.has(err.cause?.code)) continue;
        throw noDisponible();
      }
      if (res.status >= 500 && intento < maxIntentos) continue;
      if (res.status === 204) return null;
      const datos = await res.json().catch(() => null);
      if (res.ok) return datos;
      if (res.status >= 500) throw noDisponible();
      const e = datos?.error || {};
      throw new ErrorApp(res.status, e.codigo || "ERROR_REMOTO", e.mensaje || `Error en ${servicio}`, e.detalles);
    }
  }

  return {
    get: (ruta, ctx) => pedir("GET", ruta, { ctx }),
    post: (ruta, cuerpo, ctx) => pedir("POST", ruta, { cuerpo, ctx }),
    put: (ruta, cuerpo, ctx) => pedir("PUT", ruta, { cuerpo, ctx }),
    patch: (ruta, cuerpo, ctx) => pedir("PATCH", ruta, { cuerpo, ctx }),
    delete: (ruta, ctx) => pedir("DELETE", ruta, { ctx }),
  };
}
