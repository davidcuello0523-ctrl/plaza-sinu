import { contexto } from "@plaza/compartido";
import { generarImagen } from "../servicios/imagen.js";

export function crearControlador(servicio) {
  return {
    listar: async (req, res) => res.json(await servicio.listar(req.validado.query, req.usuario)),
    ver: async (req, res) => res.json(await servicio.ver(req.params.id, req.usuario)),
    crear: async (req, res) => res.status(201).json(await servicio.crear(req.usuario, req.body, contexto(req))),
    actualizar: async (req, res) => res.json(await servicio.actualizar(req.params.id, req.usuario, req.body)),
    publicacion: async (req, res) =>
      res.json(await servicio.cambiarPublicacion(req.params.id, req.usuario, req.body.publicado, contexto(req))),
    eliminar: async (req, res) => {
      await servicio.eliminar(req.params.id, req.usuario);
      res.status(204).end();
    },
    categorias: async (_req, res) => res.json({ datos: await servicio.categorias() }),
    internoPorIds: async (req, res) => res.json({ datos: await servicio.porIds(req.validado.query.ids) }),
    imagen: async (req, res) => {
      const p = await servicio.imagenDe(req.params.id);
      res.set({
        "content-type": "image/svg+xml",
        "cache-control": "public, max-age=86400",
        "cross-origin-resource-policy": "cross-origin",
      });
      res.send(generarImagen(p));
    },
  };
}
