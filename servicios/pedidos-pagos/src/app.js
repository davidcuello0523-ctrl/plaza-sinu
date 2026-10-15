// Ensambla la app Express. Recibe sus dependencias (repo, bus, clientes) desde
// fuera: las pruebas pasan dobles en memoria sin base de datos ni red.
import { fileURLToPath } from "node:url";
import { crearApp, finalizarApp } from "@plaza/compartido";
import { crearServicioPedidos } from "./servicios/pedidos.servicio.js";
import { crearControlador } from "./controladores/pedidos.controlador.js";
import { crearRutas } from "./rutas/pedidos.rutas.js";

const rutaOpenapi = fileURLToPath(new URL("../openapi.yaml", import.meta.url));

export function construirApp({ repo, bus, clientes, logger, verificaciones }) {
  const servicio = crearServicioPedidos({ repo, bus, clientes });
  const app = crearApp({ servicio: "pedidos-pagos", logger, rutaOpenapi, verificaciones });
  app.use(crearRutas(crearControlador(servicio)));
  finalizarApp(app, logger);
  app.locals.servicio = servicio; // index.js lo usa para registrar los consumidores
  return app;
}
