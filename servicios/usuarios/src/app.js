// Ensambla la app Express. Recibe sus dependencias (repo, bus) desde fuera:
// así las pruebas pueden pasar un repositorio en memoria sin base de datos.
import { fileURLToPath } from "node:url";
import { crearApp, finalizarApp } from "@plaza/compartido";
import { crearServicioUsuarios } from "./servicios/usuarios.servicio.js";
import { crearControlador } from "./controladores/usuarios.controlador.js";
import { crearRutas } from "./rutas/usuarios.rutas.js";

const rutaOpenapi = fileURLToPath(new URL("../openapi.yaml", import.meta.url));

export function construirApp({ repo, bus, logger, verificaciones }) {
  const app = crearApp({ servicio: "usuarios", logger, rutaOpenapi, verificaciones });
  app.use(crearRutas(crearControlador(crearServicioUsuarios({ repo, bus }))));
  return finalizarApp(app, logger);
}
