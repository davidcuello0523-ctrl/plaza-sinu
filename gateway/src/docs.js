import { Router } from "express";
import swaggerUi from "swagger-ui-express";
import { SERVICIOS } from "./rutas.js";

export function rutasDocs({ urlPublica }) {
  const r = Router();

  r.get("/docs/:servicio.json", async (req, res) => {
    const destino = SERVICIOS[req.params.servicio];
    if (!destino) return res.status(404).json({ error: { codigo: "NO_ENCONTRADO", mensaje: "Servicio desconocido" } });
    try {
      const resp = await fetch(`${destino.url}/openapi.json`, { signal: AbortSignal.timeout(2000) });
      const doc = await resp.json();
      doc.servers = [{ url: urlPublica, description: "API Gateway" }];
      res.json(doc);
    } catch {
      res.status(503).json({ error: { codigo: "SERVICIO_NO_DISPONIBLE", mensaje: `${req.params.servicio} no disponible` } });
    }
  });

  const urls = Object.keys(SERVICIOS).map((nombre) => ({ url: `/docs/${nombre}.json`, name: nombre }));
  r.use("/docs", swaggerUi.serveFiles(null, { swaggerOptions: { urls, persistAuthorization: true } }),
    swaggerUi.setup(null, { explorer: true, customSiteTitle: "Plaza Sinú · APIs", swaggerOptions: { urls, persistAuthorization: true } }));
  return r;
}
