import { contexto } from "@plaza/compartido";

export function crearControlador(servicio) {
  return {
    solicitar: async (req, res) => res.status(201).json(await servicio.solicitar(req.usuario, req.body, contexto(req))),
    listar: async (req, res) => res.json({ datos: await servicio.listar(req.validado.query, req.usuario) }),
    ver: async (req, res) => res.json(await servicio.verPublico(req.params.id, req.usuario)),
    yo: async (req, res) => res.json(await servicio.mio(req.usuario.id)),
    actualizarYo: async (req, res) => res.json(await servicio.actualizarMio(req.usuario.id, req.body)),
    cambiarEstado: async (req, res) => res.json(await servicio.cambiarEstado(req.params.id, req.body, contexto(req))),
    internoPorUsuario: async (req, res) => res.json(await servicio.porUsuario(req.params.usuarioId)),
    internoPorId: async (req, res) => res.json(await servicio.porId(req.params.id)),
  };
}
