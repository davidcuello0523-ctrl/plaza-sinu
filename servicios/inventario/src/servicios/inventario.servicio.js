import { ErrorNoEncontrado, ErrorProhibido } from "@plaza/compartido";
import { disponible, estadoStock, vista } from "./reglas.js";

const MINUTOS_RESERVA = 15;

const formatoReserva = (r) => ({
  id: r.id,
  pedidoId: r.pedidoId,
  estado: r.estado,
  venceEn: r.venceEn,
  motivoLiberacion: r.motivoLiberacion ?? null,
  items: r.items.map(({ productoId, cantidad }) => ({ productoId, cantidad })),
});

export function crearServicioInventario({ repo, bus, logger }) {
  async function stockOError(productoId) {
    const s = await repo.obtener(productoId);
    if (!s) throw new ErrorNoEncontrado(`No hay inventario registrado para ${productoId}`);
    return s;
  }

  function exigirDueno(stock, usuario) {
    if (usuario.rol === "admin") return;
    if (usuario.rol === "vendedor" && stock.vendedorUsuarioId === usuario.id) return;
    throw new ErrorProhibido("Solo el vendedor dueño del producto puede ver o ajustar su inventario");
  }

  function publicarCambios(stocks, ctx, { avisarStockBajo }) {
    for (const s of stocks) {
      const d = disponible(s);
      const estado = estadoStock(s);
      bus.publicar("inventario.actualizado", {
        productoId: s.productoId, stock: s.fisico, disponible: d, umbral: s.umbral, estado,
        resumen: `${s.nombreProducto || s.productoId}: ${d} disponibles (${estado.replace("_", " ")})`,
      }, ctx);
      if (avisarStockBajo && d <= s.umbral) {
        bus.publicar("inventario.stock_bajo", {
          productoId: s.productoId, nombreProducto: s.nombreProducto || s.productoId,
          vendedorUsuarioId: s.vendedorUsuarioId, disponible: d, umbral: s.umbral,
          resumen: `Stock bajo: ${s.nombreProducto || s.productoId} (${d} uds)`,
        }, ctx);
      }
    }
  }

  const unidades = (r) => r.items.reduce((t, i) => t + i.cantidad, 0);

  return {
    async obtener(productoId) {
      return vista(await stockOError(productoId));
    },

    async disponibilidad(items) {
      const stocks = new Map((await repo.obtenerVarios(items.map((i) => i.productoId))).map((s) => [s.productoId, s]));
      return items.map(({ productoId, cantidad }) => {
        const s = stocks.get(productoId);
        const d = s ? Math.max(0, disponible(s)) : 0;
        return { productoId, disponible: d, solicitado: cantidad, alcanza: d >= cantidad, estado: s ? estadoStock(s) : "agotado" };
      });
    },

    async listar(usuario) {
      const filtro = usuario.rol === "admin" ? {} : { vendedorUsuarioId: usuario.id };
      return (await repo.listar(filtro)).map(vista);
    },

    async movimientos(productoId, usuario) {
      exigirDueno(await stockOError(productoId), usuario);
      return repo.movimientos(productoId);
    },

    async ajustar(productoId, { fisico, umbral, nota }, usuario, ctx = {}) {
      exigirDueno(await stockOError(productoId), usuario);
      const s = await repo.ajustar(productoId, { fisico, umbral, nota, referencia: `ajuste:${usuario.id}` });
      publicarCambios([s], ctx, { avisarStockBajo: true });
      return vista(s);
    },

    async reservar({ pedidoId, items, minutos = MINUTOS_RESERVA }) {
      const venceEn = new Date(Date.now() + minutos * 60_000);
      const { reserva, nueva } = await repo.reservar({ pedidoId, items, venceEn });
      return { reserva: formatoReserva(reserva), nueva };
    },

    async confirmar(id, ctx = {}) {
      const r = await repo.confirmar(id);
      if (!r) throw new ErrorNoEncontrado("Reserva no encontrada");
      if (r.cambiado) {
        publicarCambios(r.stocks, ctx, { avisarStockBajo: true });
        bus.publicar("reserva.confirmada", {
          pedidoId: r.reserva.pedidoId, reservaId: r.reserva.id, unidades: unidades(r.reserva),
          resumen: `Stock confirmado: ${unidades(r.reserva)} uds descontadas`,
        }, ctx);
      }
      return formatoReserva(r.reserva);
    },

    async liberar(id, motivo = "cancelado", ctx = {}) {
      const r = await repo.liberar(id, motivo);
      if (!r) throw new ErrorNoEncontrado("Reserva no encontrada");
      if (r.cambiado) {
        publicarCambios(r.stocks, ctx, { avisarStockBajo: false });
        bus.publicar("reserva.liberada", {
          pedidoId: r.reserva.pedidoId, reservaId: r.reserva.id, motivo,
          resumen: `Reserva liberada (${motivo.replace("_", " ")}): ${unidades(r.reserva)} uds devueltas`,
        }, ctx);
      }
      return formatoReserva(r.reserva);
    },

    async liberarVencidas() {
      for (const id of await repo.reservasVencidas(new Date())) {
        try {
          await this.liberar(id, "vencida");
        } catch (err) {
          logger?.warn({ reservaId: id, err: err.message }, "no se pudo liberar reserva vencida");
        }
      }
    },

    registrarProducto: (datos) => repo.registrarProducto(datos),
  };
}
