import { contexto } from "@plaza/compartido";

export function crearControlador(servicio) {
  return {
    ver: async (req, res) => res.json(await servicio.ver(req.usuario.id, contexto(req))),
    agregar: async (req, res) => res.status(201).json(await servicio.agregar(req.usuario.id, req.body, contexto(req))),
    cambiarCantidad: async (req, res) =>
      res.json(await servicio.cambiarCantidad(req.usuario.id, req.params.productoId, req.body.cantidad, contexto(req))),
    quitar: async (req, res) => res.json(await servicio.quitar(req.usuario.id, req.params.productoId, contexto(req))),
    vaciar: async (req, res) => {
      await servicio.vaciar(req.usuario.id);
      res.status(204).end();
    },
    verInterno: async (req, res) => res.json(await servicio.ver(req.params.usuarioId, contexto(req))),
    vaciarInterno: async (req, res) => {
      await servicio.vaciar(req.params.usuarioId);
      res.status(204).end();
    },
  };
}
