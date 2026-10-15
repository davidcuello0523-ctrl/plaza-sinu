// Base común de cada servicio Express: seguridad, correlationId, logs por
// petición, /salud, /salud/listo y /docs. Cada servicio solo agrega sus rutas.
import express from "express";
import helmet from "helmet";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import YAML from "yaml";
import swaggerUi from "swagger-ui-express";
import { manejadorErrores, rutaNoEncontrada } from "./errores.js";

// X-Correlation-Id: llega del gateway (o se crea aquí) y viaja a todas las
// llamadas y eventos siguientes. Con él se sigue una compra por los 7 servicios.
export function correlacion(req, res, next) {
  req.correlationId = req.headers["x-correlation-id"] || randomUUID();
  res.setHeader("x-correlation-id", req.correlationId);
  next();
}

export function registroPeticiones(logger) {
  return (req, res, next) => {
    const inicio = process.hrtime.bigint();
    res.on("finish", () => {
      if (req.path.startsWith("/salud")) return; // los healthchecks llenarían el log
      const duracionMs = Number(process.hrtime.bigint() - inicio) / 1e6;
      logger[res.statusCode >= 500 ? "error" : "info"]({
        metodo: req.method,
        ruta: req.originalUrl,
        status: res.statusCode,
        duracionMs: Math.round(duracionMs * 10) / 10,
        correlationId: req.correlationId,
        usuarioId: req.usuario?.id,
      }, "petición");
    });
    next();
  };
}

// verificaciones: { nombre: async () => true/false } para la readiness.
export function rutasSalud(servicio, verificaciones = {}) {
  const router = express.Router();
  router.get("/salud", (_req, res) => res.json({ servicio, estado: "arriba", uptimeS: Math.round(process.uptime()) }));
  router.get("/salud/listo", async (_req, res) => {
    const dependencias = {};
    for (const [nombre, verificar] of Object.entries(verificaciones)) {
      try { dependencias[nombre] = (await verificar()) ? "ok" : "caido"; } catch { dependencias[nombre] = "caido"; }
    }
    const listo = Object.values(dependencias).every((v) => v === "ok");
    res.status(listo ? 200 : 503).json({ servicio, estado: listo ? "listo" : "no_listo", dependencias });
  });
  return router;
}

export function rutasDocs(rutaOpenapi) {
  const router = express.Router();
  const documento = YAML.parse(readFileSync(rutaOpenapi, "utf8"));
  router.get("/openapi.json", (_req, res) => res.json(documento));
  router.use("/docs", swaggerUi.serve, swaggerUi.setup(documento));
  return router;
}

export function crearApp({ servicio, logger, rutaOpenapi, verificaciones }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false })); // CSP off: Swagger UI usa scripts en línea
  app.use(express.json({ limit: "1mb" }));
  app.use(correlacion);
  app.use(registroPeticiones(logger));
  app.use(rutasSalud(servicio, verificaciones));
  if (rutaOpenapi) app.use(rutasDocs(rutaOpenapi));
  return app;
}

// Se llama después de montar las rutas del servicio.
export function finalizarApp(app, logger) {
  app.use(rutaNoEncontrada);
  app.use(manejadorErrores(logger));
  return app;
}

// Arranque con apagado ordenado (docker compose stop envía SIGTERM).
export function iniciarServidor(app, { puerto, logger, alCerrar = async () => {} }) {
  const servidor = app.listen(puerto, () => logger.info({ puerto }, "servicio escuchando"));
  const apagar = async (senal) => {
    logger.info({ senal }, "apagando servicio");
    servidor.close();
    await alCerrar();
    process.exit(0);
  };
  process.on("SIGTERM", apagar);
  process.on("SIGINT", apagar);
  return servidor;
}
