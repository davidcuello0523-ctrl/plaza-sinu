// Controladores: traducen HTTP ↔ lógica y eligen el código de estado.
import { ErrorPeticion, contexto } from "@plaza/compartido";

export function crearControlador(servicio) {
  return {
    crear: async (req, res) => {
      const idempotencyKey = req.headers["idempotency-key"];
      if (!idempotencyKey) throw new ErrorPeticion("Falta el header Idempotency-Key (evita pedidos duplicados si repites la petición)");
      const { pedido, repetido } = await servicio.crear(
        { usuario: req.usuario, idempotencyKey: String(idempotencyKey).slice(0, 100), direccion: req.body.direccion },
        contexto(req),
      );
      // 201 si se creó ahora; 200 si es la repetición de una petición anterior.
      res.status(repetido ? 200 : 201).json(pedido);
    },
    listar: async (req, res) => res.json(await servicio.listar(req.usuario, req.validado.query)),
    detalle: async (req, res) => res.json(await servicio.detalle(req.usuario, req.params.id)),
    traza: async (req, res) => res.json(await servicio.traza(req.usuario, req.params.id)),
    pagar: async (req, res) =>
      res.status(201).json(await servicio.pagar({ usuario: req.usuario, pedidoId: req.params.id, tarjeta: req.body }, contexto(req))),
    cambiarEstado: async (req, res) =>
      res.json(await servicio.cambiarEstadoSubpedido({ usuario: req.usuario, pedidoId: req.params.id, ...req.body }, contexto(req))),
    cancelar: async (req, res) => res.json(await servicio.cancelar({ usuario: req.usuario, pedidoId: req.params.id }, contexto(req))),
    metricas: async (_req, res) => res.json(await servicio.metricas()),
    metricasVendedor: async (req, res) => res.json(await servicio.metricasVendedor(req.usuario)),
  };
}
