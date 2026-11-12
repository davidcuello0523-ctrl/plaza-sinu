import { fileURLToPath } from "node:url";
import { crearApp, finalizarApp } from "@plaza/compartido";
import { crearServicioCarrito } from "./servicios/carrito.servicio.js";
import { crearControlador } from "./controladores/carrito.controlador.js";
import { crearRutas } from "./rutas/carrito.rutas.js";

const rutaOpenapi = fileURLToPath(new URL("../openapi.yaml", import.meta.url));

export function construirApp({ repo, clientes, logger, verificaciones }) {
  const app = crearApp({ servicio: "carrito", logger, rutaOpenapi, verificaciones });
  app.use(crearRutas(crearControlador(crearServicioCarrito({ repo, clientes }))));
  return finalizarApp(app, logger);
}
