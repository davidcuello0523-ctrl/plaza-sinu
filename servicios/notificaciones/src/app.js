import { fileURLToPath } from "node:url";
import { crearApp, finalizarApp } from "@plaza/compartido";
import { crearServicioNotificaciones } from "./servicios/notificaciones.servicio.js";
import { crearControlador } from "./controladores/notificaciones.controlador.js";
import { crearRutas } from "./rutas/notificaciones.rutas.js";
import { crearHub } from "./hub.js";

const rutaOpenapi = fileURLToPath(new URL("../openapi.yaml", import.meta.url));

export function construirApp({ repo, bus, logger, verificaciones, hub = crearHub() }) {
  const servicio = crearServicioNotificaciones({ repo, hub, bus, logger });
  const app = crearApp({ servicio: "notificaciones", logger, rutaOpenapi, verificaciones });
  app.use(crearRutas(crearControlador(servicio, hub)));
  app.locals.servicio = servicio;
  return finalizarApp(app, logger);
}
