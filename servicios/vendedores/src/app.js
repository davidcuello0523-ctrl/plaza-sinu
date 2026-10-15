// Ensambla la app Express con sus dependencias inyectadas (repo, bus).
import { fileURLToPath } from "node:url";
import { crearApp, finalizarApp } from "@plaza/compartido";
import { crearServicioVendedores } from "./servicios/vendedores.servicio.js";
import { crearControlador } from "./controladores/vendedores.controlador.js";
import { crearRutas } from "./rutas/vendedores.rutas.js";

const rutaOpenapi = fileURLToPath(new URL("../openapi.yaml", import.meta.url));

export function construirApp({ repo, bus, logger, verificaciones }) {
  const app = crearApp({ servicio: "vendedores", logger, rutaOpenapi, verificaciones });
  app.use(crearRutas(crearControlador(crearServicioVendedores({ repo, bus }))));
  return finalizarApp(app, logger);
}
