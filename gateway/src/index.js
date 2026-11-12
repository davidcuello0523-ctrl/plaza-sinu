import { crearBus, crearLogger, iniciarServidor } from "@plaza/compartido";
import { crearMonitor } from "./monitor.js";
import { construirGateway } from "./app.js";

const logger = crearLogger("gateway");
const bus = crearBus({ servicio: "gateway", logger });
const monitor = crearMonitor({ bus, logger });
const app = construirGateway({ logger, monitor, urlPublica: process.env.URL_PUBLICA || "http://localhost:8080" });

iniciarServidor(app, { puerto: Number(process.env.PUERTO || 8080), logger, alCerrar: () => bus.cerrar() });
bus.conectar();
