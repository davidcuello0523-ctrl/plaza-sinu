import express from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { createProxyMiddleware } from "http-proxy-middleware";
import {
  ErrorNoAutenticado, ErrorNoEncontrado, ErrorServicioNoDisponible, correlacion, manejadorErrores, registroPeticiones,
  requerirRol, autenticar, rutaNoEncontrada, verificarJwt,
} from "@plaza/compartido";
import { SERVICIOS, esInterna, esPublica, servicioDe } from "./rutas.js";
import { rutasDocs } from "./docs.js";

export function construirGateway({ logger, monitor, urlPublica = "http://localhost:8080" }) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  const origenes = (process.env.CORS_ORIGENES || "http://localhost:3000,http://localhost:5173").split(",");
  app.use(cors({ origin: origenes, exposedHeaders: ["x-correlation-id"] }));
  app.use(correlacion);
  app.use(registroPeticiones(logger));
  app.use((req, res, next) => { res.on("finish", () => monitor.registrarHttp(req, res)); next(); });

  app.get("/salud", async (_req, res) => {
    const salud = await monitor.saludAgregada();
    res.status(salud.estado === "ok" ? 200 : 503).json(salud);
  });
  app.use(rutasDocs({ urlPublica }));
  app.get("/monitor/eventos", autenticar, requerirRol("admin"), (_req, res) => res.json({ datos: monitor.recientes() }));
  app.get("/monitor/colas", autenticar, requerirRol("admin"), async (_req, res) => res.json({ datos: await monitor.colas() }));
  app.get("/monitor/stream", autenticar, requerirRol("admin"), monitor.stream);

  app.use("/auth", rateLimit({
    windowMs: 60_000,
    limit: Number(process.env.RATE_LIMIT_AUTH || 30),
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({ error: {
      codigo: "DEMASIADAS_PETICIONES", mensaje: "Demasiados intentos, espera un minuto", detalles: [], correlationId: req.correlationId } }),
  }));

  app.use((req, _res, next) => {
    delete req.headers["x-usuario-id"];
    delete req.headers["x-usuario-rol"];
    delete req.headers["x-clave-interna"];
    req.headers["x-correlation-id"] = req.correlationId;

    const servicio = servicioDe(req.path);
    if (!servicio || esInterna(req.path)) return next(new ErrorNoEncontrado(`No existe la ruta ${req.method} ${req.path}`));
    req.servicioDestino = servicio;

    const auth = req.headers.authorization;
    const tokenQuery = req.query.token;
    if (auth?.startsWith("Bearer ") || tokenQuery) {
      try {
        const usuario = verificarJwt(auth?.startsWith("Bearer ") ? auth.slice(7) : tokenQuery);
        req.headers["x-usuario-id"] = usuario.id;
        req.headers["x-usuario-rol"] = usuario.rol;
        req.usuario = usuario;
      } catch (err) {
        if (!esPublica(req.method, req.path)) return next(err);
      }
    }
    if (!req.usuario && !esPublica(req.method, req.path)) return next(new ErrorNoAutenticado());
    next();
  });

  for (const [nombre, { url }] of Object.entries(SERVICIOS)) {
    app.use(createProxyMiddleware({
      target: url,
      changeOrigin: true,
      pathFilter: (_ruta, req) => req.servicioDestino === nombre,
      proxyTimeout: 15000,
      on: {
        error: (_err, req, res) => {
          const e = new ErrorServicioNoDisponible(`${nombre} no está disponible en este momento, intenta en unos segundos`);
          if (res.headersSent) return res.end();
          res.status(e.status).json({ error: { codigo: e.codigo, mensaje: e.message, detalles: [], correlationId: req.correlationId } });
        },
      },
    }));
  }

  app.use(rutaNoEncontrada);
  app.use(manejadorErrores(logger));
  return app;
}
