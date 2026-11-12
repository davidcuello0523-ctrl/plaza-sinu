import { fileURLToPath } from "node:url";
import { crearApp, finalizarApp } from "@plaza/compartido";
import { crearServicioCatalogo } from "./servicios/catalogo.servicio.js";
import { crearControlador } from "./controladores/catalogo.controlador.js";
import { crearRutas } from "./rutas/catalogo.rutas.js";

const rutaOpenapi = fileURLToPath(new URL("../openapi.yaml", import.meta.url));

export function construirApp({ repo, bus, clientes, logger, verificaciones }) {
  const app = crearApp({ servicio: "catalogo", logger, rutaOpenapi, verificaciones });
  app.use(crearRutas(crearControlador(crearServicioCatalogo({ repo, bus, clientes }))));
  return finalizarApp(app, logger);
}
