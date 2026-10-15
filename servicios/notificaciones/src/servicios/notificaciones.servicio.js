// Lógica de notificaciones: consultar/marcar las propias y procesar eventos.
import { ErrorNoEncontrado, ErrorProhibido } from "@plaza/compartido";
import { notificacionesPara } from "../mensajes.js";

export function crearServicioNotificaciones({ repo, hub, bus, logger }) {
  async function propia(id, usuarioId) {
    const n = await repo.buscarPorId(id);
    if (!n) throw new ErrorNoEncontrado("Notificación no encontrada");
    if (n.usuarioId !== usuarioId) throw new ErrorProhibido("Esa notificación no es tuya");
    return n;
  }

  return {
    listar: (usuarioId, opciones) => repo.listar(usuarioId, opciones),
    contarNoLeidas: (usuarioId) => repo.contarNoLeidas(usuarioId),

    async marcarLeida(id, usuarioId) {
      await propia(id, usuarioId);
      return repo.marcarLeida(id);
    },

    marcarTodas: async (usuarioId) => ({ actualizadas: await repo.marcarTodas(usuarioId) }),

    // Consumidor: evento → notificaciones guardadas → push SSE → correo simulado.
    async procesarEvento(evento) {
      const lista = notificacionesPara(evento).filter((n) => n.usuarioId);
      for (const { correo, ...n } of lista) {
        const guardada = await repo.crear({
          ...n, eventoId: evento.id, eventoTipo: evento.tipo, correlationId: evento.correlationId,
        });
        hub.enviar(n.usuarioId, "notificacion", guardada);
        if (correo) {
          const para = correo.para || n.usuarioId;
          await repo.guardarCorreo({ para, asunto: correo.asunto, cuerpo: `${n.titulo}\n\n${n.mensaje}`, eventoTipo: evento.tipo });
          logger.info({ correlationId: evento.correlationId, para, asunto: correo.asunto }, "correo simulado enviado");
        }
      }
      // Avisamos a pedidos-pagos para que la traza muestre "notificaciones: avisados".
      if (evento.datos?.pedidoId && lista.length) {
        const roles = [...new Set(lista.map((n) => n.rol))].join(" y ");
        bus.publicar("notificacion.enviada", {
          pedidoId: evento.datos.pedidoId,
          eventoOrigen: evento.tipo,
          destinatarios: lista.map((n) => ({ usuarioId: n.usuarioId, rol: n.rol })),
          resumen: `${lista.length} aviso(s) a ${roles} por ${evento.tipo}`,
        }, { correlationId: evento.correlationId });
      }
      return lista.length;
    },
  };
}
