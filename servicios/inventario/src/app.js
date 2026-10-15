// Ensambla la app Express con sus dependencias inyectadas (repo, bus):
// las pruebas pasan un repositorio en memoria sin base de datos.
import { fileURLToPath } from "node:url";
import { crearApp, finalizarApp } from "@plaza/compartido";
import { crearServicioInventario } from "./servicios/inventario.servicio.js";
import { crearControlador } from "./controladores/inventario.controlador.js";
import { crearRutas } from "./rutas/inventario.rutas.js";

const rutaOpenapi = fileURLToPath(new URL("../openapi.yaml", import.meta.url));

export function construirApp({ repo, bus, logger, verificaciones, servicio }) {
  const app = crearApp({ servicio: "inventario", logger, rutaOpenapi, verificaciones });
  app.use(crearRutas(crearControlador(servicio ?? crearServicioInventario({ repo, bus, logger }))));
  return finalizarApp(app, logger);
}
