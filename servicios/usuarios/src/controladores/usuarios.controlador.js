// Controladores: traducen HTTP ↔ lógica. Leen req, llaman al servicio y
// eligen el código de estado. Los errores los maneja el middleware central.
import { contexto } from "@plaza/compartido";

export function crearControlador(servicio) {
  return {
    registro: async (req, res) => res.status(201).json(await servicio.registrar(req.body, contexto(req))),
    login: async (req, res) => res.json(await servicio.login(req.body)),
    refresh: async (req, res) => res.json(await servicio.refrescar(req.body.refreshToken)),
    logout: async (req, res) => {
      await servicio.logout(req.body.refreshToken);
      res.status(204).end();
    },
    yo: async (req, res) => res.json(await servicio.perfil(req.usuario.id)),
    actualizarYo: async (req, res) => res.json(await servicio.actualizarPerfil(req.usuario.id, req.body)),
    listar: async (_req, res) => res.json({ datos: await servicio.listar() }),
  };
}
