// Controladores: HTTP ↔ lógica. Los errores los maneja el middleware central.
import { contexto } from "@plaza/compartido";

export function crearControlador(servicio) {
  return {
    listar: async (req, res) => res.json({ datos: await servicio.listar(req.usuario) }),
    obtener: async (req, res) => res.json(await servicio.obtener(req.params.productoId)),
    disponibilidad: async (req, res) => res.json({ datos: await servicio.disponibilidad(req.body.items) }),
    ajustar: async (req, res) =>
      res.json(await servicio.ajustar(req.params.productoId, req.body, req.usuario, contexto(req))),
    movimientos: async (req, res) =>
      res.json({ datos: await servicio.movimientos(req.params.productoId, req.usuario) }),

    reservar: async (req, res) => {
      const { reserva, nueva } = await servicio.reservar(req.body);
      res.status(nueva ? 201 : 200).json(reserva); // 200 = misma reserva (petición repetida)
    },
    confirmar: async (req, res) => res.json(await servicio.confirmar(req.params.id, contexto(req))),
    liberar: async (req, res) => res.json(await servicio.liberar(req.params.id, req.body?.motivo, contexto(req))),
  };
}
