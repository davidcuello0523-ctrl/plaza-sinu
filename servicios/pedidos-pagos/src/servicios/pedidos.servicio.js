// Lógica de pedidos y pagos: este servicio ORQUESTA la saga de compra.
//   carrito (REST) → catálogo (REST, precios) → inventario (REST, reserva)
//   → pedido guardado → pago (pasarela simulada) → eventos para el resto.
import { randomUUID } from "node:crypto";
import {
  ErrorApp, ErrorConflicto, ErrorNoEncontrado, ErrorProhibido,
} from "@plaza/compartido";
import {
  ESTADOS_VENDIDOS, calcularTotales, formatoCOP, procesarPago, validarTransicionPedido, validarTransicionSubpedido,
} from "./dominio.js";

// Fecha local de Colombia (YYYY-MM-DD) para agrupar ventas por día.
const diaBogota = (fecha) => new Date(fecha).toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

const MOTIVOS_LIBERACION = {
  pago_rechazado: "pago rechazado",
  vencida: "venció sin pago",
  cancelado: "pedido cancelado",
};

export function crearServicioPedidos({ repo, bus, clientes }) {
  // Marca de tiempo estrictamente creciente: los pasos creados en el mismo
  // milisegundo conservan su orden en la traza.
  let ultimo = 0;
  const ahora = () => { ultimo = Math.max(Date.now(), ultimo + 1); return new Date(ultimo); };
  const paso = (servicio, accion, detalle, via, correlationId) => ({ servicio, accion, detalle, via, correlationId, ocurridoEn: ahora() });

  const resumenSubpedidos = (pedido) => pedido.subpedidos.map((s) => ({
    subpedidoId: s.id, vendedorId: s.vendedorId, vendedorUsuarioId: s.vendedorUsuarioId,
    nombreTienda: s.nombreTienda, unidades: s.unidades, subtotal: s.subtotal,
  }));

  async function obtener(id) {
    const pedido = await repo.buscarPedido(id);
    if (!pedido) throw new ErrorNoEncontrado("Pedido no encontrado");
    return pedido;
  }

  // Autorización POR RECURSO: el cliente ve sus pedidos; el vendedor solo
  // los sub-pedidos de su puesto; el admin, todo.
  function vistaPara(pedido, usuario) {
    if (usuario.rol === "admin") return pedido;
    if (usuario.rol === "cliente" && pedido.clienteId === usuario.id) return pedido;
    if (usuario.rol === "vendedor") {
      const propios = pedido.subpedidos.filter((s) => s.vendedorUsuarioId === usuario.id);
      if (propios.length) return { ...pedido, subpedidos: propios };
    }
    throw new ErrorProhibido("No tienes acceso a este pedido");
  }

  return {
    vistaPara,

    // ---------- Checkout (saga orquestada) ----------
    async crear({ usuario, idempotencyKey, direccion }, ctx = {}) {
      // 1. Idempotencia: repetir la petición devuelve el MISMO pedido.
      const previo = await repo.buscarPorIdempotencia(usuario.id, idempotencyKey);
      if (previo) return { pedido: previo, repetido: true };

      const cid = ctx.correlationId;
      // 2. Leer el carrito (REST a carrito).
      const carrito = await clientes.carrito.get(`/interno/carrito/${usuario.id}`, ctx);
      const lineasCarrito = (carrito?.grupos || []).flatMap((g) => g.items);
      if (!lineasCarrito.length) throw new ErrorApp(422, "CARRITO_VACIO", "Tu carrito está vacío");
      // Si inventario no respondió al carrito, el stock queda "desconocido":
      // seguimos y la reserva decidirá (y dará 503 si inventario sigue caído).
      const stockSinVerificar = lineasCarrito.every((l) => l.estadoStock === "desconocido");
      if (carrito.valido === false && !stockSinVerificar) {
        throw new ErrorConflicto("Tu carrito tiene productos con problemas, revísalo antes de pagar", "CARRITO_INVALIDO",
          (carrito.avisos || []).map((mensaje) => ({ mensaje })));
      }

      // 3. Precios ACTUALES del catálogo: se congelan en el pedido (snapshot).
      const ids = [...new Set(lineasCarrito.map((l) => l.productoId))];
      const { datos: productos } = await clientes.catalogo.get(`/interno/productos?ids=${ids.join(",")}`, ctx);
      const porId = new Map(productos.map((p) => [p.id, p]));
      const lineas = lineasCarrito.map((l) => {
        const p = porId.get(l.productoId);
        if (!p || !p.publicado || p.eliminado) {
          throw new ErrorConflicto(`${l.nombre || l.productoId} ya no está disponible`, "PRODUCTO_NO_DISPONIBLE", [{ productoId: l.productoId }]);
        }
        return {
          productoId: p.id, nombre: p.nombre, categoria: p.categoria, imagen: p.imagen, precioUnitario: p.precio,
          cantidad: l.cantidad, vendedorId: p.vendedorId, vendedorUsuarioId: p.vendedorUsuarioId, nombreTienda: p.nombreTienda,
        };
      });
      const { subpedidos, total, unidades } = calcularTotales(lineas);

      const pedidoId = randomUUID();
      const base = {
        id: pedidoId, clienteId: usuario.id, clienteNombre: usuario.nombre || "Cliente", clienteEmail: usuario.email,
        total, unidades, direccion, idempotencyKey, correlationId: cid || randomUUID(),
      };
      const pasosPrevios = [
        paso("carrito", "carrito leído y validado", `${unidades} uds de ${subpedidos.length} puesto(s)`, "REST", cid),
        paso("catalogo", "precios congelados en el pedido", `Total ${formatoCOP(total)}`, "REST", cid),
      ];

      // 4. Reservar stock (REST a inventario). Si inventario está caído, el
      //    error 503 sale de aquí ANTES de guardar nada: nada queda a medias.
      let reserva;
      try {
        reserva = await clientes.inventario.post("/reservas", {
          pedidoId, items: lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })), minutos: 15,
        }, ctx);
      } catch (err) {
        if (err.status !== 409) throw err;
        // Sin stock: el pedido queda registrado como RECHAZADO_SIN_STOCK.
        const codigo = await repo.siguienteCodigo();
        const rechazado = await repo.crearPedido({
          ...base, codigo, estado: "RECHAZADO_SIN_STOCK", motivo: err.message,
          subpedidos: subpedidos.map((s) => ({ ...s, estado: "CANCELADO" })),
          pasos: [
            ...pasosPrevios,
            paso("pedidos-pagos", `pedido ${codigo} creado`, "Intento de compra registrado", "REST", cid),
            paso("inventario", "sin stock suficiente", err.message, "REST", cid),
          ],
        });
        throw new ErrorConflicto(err.message, err.codigo || "STOCK_INSUFICIENTE",
          [...(err.detalles || []), { pedidoId: rechazado.id, codigo }]);
      }

      // 5. Guardar el pedido PENDIENTE_PAGO con sus sub-pedidos y la traza.
      const codigo = await repo.siguienteCodigo();
      let pedido;
      try {
        pedido = await repo.crearPedido({
          ...base, codigo, estado: "PENDIENTE_PAGO", reservaId: reserva.id,
          subpedidos: subpedidos.map((s) => ({ ...s, estado: "PENDIENTE_PAGO" })),
          pasos: [
            ...pasosPrevios,
            paso("pedidos-pagos", `pedido ${codigo} creado`, `PENDIENTE_PAGO · ${formatoCOP(total)}`, "REST", cid),
            paso("inventario", `${unidades} uds reservadas por 15 min`, `Reserva ${String(reserva.id).slice(0, 8)}`, "REST", cid),
          ],
        });
      } catch (e) {
        // Compensación: si el pedido no se pudo guardar, la reserva se libera.
        await clientes.inventario.post(`/reservas/${reserva.id}/liberar`, {}, ctx).catch(() => {});
        if (e.codigo === "IDEMPOTENCIA") return { pedido: await repo.buscarPorIdempotencia(usuario.id, idempotencyKey), repetido: true };
        throw e;
      }

      bus.publicar("pedido.creado", {
        pedidoId: pedido.id, codigo, clienteId: usuario.id, clienteNombre: pedido.clienteNombre, total, unidades,
        subpedidos: resumenSubpedidos(pedido),
        resumen: `Pedido ${codigo} creado · ${unidades} uds · ${formatoCOP(total)}`,
      }, { correlationId: base.correlationId });
      return { pedido, repetido: false };
    },

    // ---------- Pago con la pasarela simulada ----------
    async pagar({ usuario, pedidoId, tarjeta }, ctx = {}) {
      const pedido = await obtener(pedidoId);
      if (pedido.clienteId !== usuario.id) throw new ErrorProhibido("Solo el dueño del pedido puede pagarlo");
      if (pedido.estado !== "PENDIENTE_PAGO") {
        throw new ErrorConflicto(`El pedido ${pedido.codigo} está ${pedido.estado} y no se puede pagar`, "PEDIDO_NO_PAGABLE");
      }
      const r = procesarPago(tarjeta);
      const cid = ctx.correlationId || pedido.correlationId;
      const pago = {
        estado: r.estado, marca: r.marca, ultimos4: r.ultimos4, titular: tarjeta.titular,
        monto: pedido.total, referencia: r.referencia, motivo: r.motivo,
      };

      if (r.estado === "APROBADO") {
        const ok = await repo.transicionarPedido({
          pedidoId, desde: ["PENDIENTE_PAGO"], hacia: "PAGADO", estadoSubpedidos: "PAGADO", pago,
          pasos: [paso("pedidos-pagos", `pago aprobado (•••• ${r.ultimos4})`, `${r.marca} · ${formatoCOP(pedido.total)} · ref ${r.referencia}`, "REST", cid)],
        });
        if (!ok) throw new ErrorConflicto(`El pedido ${pedido.codigo} ya no está pendiente de pago`, "PEDIDO_NO_PAGABLE");
        bus.publicar("pago.aprobado", {
          pedidoId, codigo: pedido.codigo, clienteId: pedido.clienteId, reservaId: pedido.reservaId, total: pedido.total,
          marca: r.marca, ultimos4: r.ultimos4, subpedidos: resumenSubpedidos(pedido),
          resumen: `Pago aprobado ${pedido.codigo} · ${formatoCOP(pedido.total)} (•••• ${r.ultimos4})`,
        }, { correlationId: cid });
        const actualizado = await repo.buscarPedido(pedidoId);
        return { pago: actualizado.pagos.at(-1), pedido: actualizado };
      }

      const ok = await repo.transicionarPedido({
        pedidoId, desde: ["PENDIENTE_PAGO"], hacia: "PAGO_RECHAZADO", estadoSubpedidos: "CANCELADO", motivo: r.motivo, pago,
        pasos: [paso("pedidos-pagos", `pago rechazado (•••• ${r.ultimos4})`, r.motivo, "REST", cid)],
      });
      if (!ok) throw new ErrorConflicto(`El pedido ${pedido.codigo} ya no está pendiente de pago`, "PEDIDO_NO_PAGABLE");
      bus.publicar("pago.rechazado", {
        pedidoId, codigo: pedido.codigo, clienteId: pedido.clienteId, reservaId: pedido.reservaId, motivo: r.motivo,
        resumen: `Pago rechazado ${pedido.codigo}: ${r.motivo}`,
      }, { correlationId: cid });
      throw new ErrorApp(402, "PAGO_RECHAZADO", `Pago rechazado: ${r.motivo}`,
        [{ pedidoId, codigo: pedido.codigo, estado: "PAGO_RECHAZADO" }]);
    },

    // ---------- Consultas ----------
    async listar(usuario, { estado, pagina, porPagina }) {
      const filtro = { estado, pagina, porPagina };
      if (usuario.rol === "cliente") filtro.clienteId = usuario.id;
      if (usuario.rol === "vendedor") filtro.vendedorUsuarioId = usuario.id;
      const { datos, total } = await repo.listarPedidos(filtro);
      return { datos, pagina, porPagina, total, totalPaginas: Math.max(1, Math.ceil(total / porPagina)) };
    },

    async detalle(usuario, id) {
      return vistaPara(await obtener(id), usuario);
    },

    async traza(usuario, id) {
      const pedido = vistaPara(await obtener(id), usuario);
      const pasos = await repo.listarPasos(id);
      return { pedido: { id: pedido.id, codigo: pedido.codigo, estado: pedido.estado, correlationId: pedido.correlationId }, pasos };
    },

    // ---------- El vendedor avanza su sub-pedido ----------
    async cambiarEstadoSubpedido({ usuario, pedidoId, subpedidoId, estado }, ctx = {}) {
      const pedido = await obtener(pedidoId);
      const sub = pedido.subpedidos.find((s) => s.id === subpedidoId);
      if (!sub) throw new ErrorNoEncontrado("Sub-pedido no encontrado en este pedido");
      if (usuario.rol !== "admin" && sub.vendedorUsuarioId !== usuario.id) {
        throw new ErrorProhibido("Solo el vendedor de este sub-pedido puede cambiar su estado");
      }
      validarTransicionSubpedido(sub.estado, estado);
      const cid = ctx.correlationId;
      const ok = await repo.actualizarSubpedido({
        subpedidoId, desde: sub.estado, hacia: estado,
        paso: { pedidoId, ...paso("pedidos-pagos", `${sub.nombreTienda}: ${estado.toLowerCase()}`, `${sub.estado} → ${estado}`, "REST", cid) },
      });
      if (!ok) throw new ErrorConflicto("El sub-pedido cambió mientras tanto, recarga e intenta de nuevo", "CONFLICTO_CONCURRENCIA");

      bus.publicar("pedido.estado_cambiado", {
        pedidoId, codigo: pedido.codigo, subpedidoId, clienteId: pedido.clienteId, nombreTienda: sub.nombreTienda,
        estadoAnterior: sub.estado, estadoNuevo: estado,
        resumen: `${pedido.codigo} · ${sub.nombreTienda}: ${sub.estado} → ${estado}`,
      }, { correlationId: cid || pedido.correlationId });

      // Cuando TODOS los puestos entregaron, el pedido completo se cierra.
      const actualizado = await obtener(pedidoId);
      const activos = actualizado.subpedidos.filter((s) => s.estado !== "CANCELADO");
      if (activos.length && activos.every((s) => s.estado === "ENTREGADO") && actualizado.estado === "PAGADO") {
        validarTransicionPedido("PAGADO", "COMPLETADO");
        await repo.transicionarPedido({
          pedidoId, desde: ["PAGADO"], hacia: "COMPLETADO",
          pasos: [paso("pedidos-pagos", "pedido completado", "Todos los puestos entregaron", "REST", cid)],
        });
      }
      return vistaPara(await obtener(pedidoId), usuario);
    },

    // ---------- Cancelación por el cliente ----------
    async cancelar({ usuario, pedidoId }, ctx = {}) {
      const pedido = await obtener(pedidoId);
      if (usuario.rol !== "admin" && pedido.clienteId !== usuario.id) throw new ErrorProhibido("Solo el dueño del pedido puede cancelarlo");
      validarTransicionPedido(pedido.estado, "CANCELADO");
      // Primero se libera el stock (REST); si inventario no responde → 503 y el pedido no cambia.
      if (pedido.reservaId) await clientes.inventario.post(`/reservas/${pedido.reservaId}/liberar`, {}, ctx);
      const ok = await repo.transicionarPedido({
        pedidoId, desde: ["PENDIENTE_PAGO"], hacia: "CANCELADO", estadoSubpedidos: "CANCELADO", motivo: "Cancelado por el cliente",
        pasos: [paso("pedidos-pagos", "pedido cancelado", "Cancelado por el cliente; reserva liberada", "REST", ctx.correlationId)],
      });
      if (!ok) throw new ErrorConflicto("El pedido ya no se puede cancelar", "TRANSICION_INVALIDA");
      return obtener(pedidoId);
    },

    // ---------- Consumidores de eventos (actualizan la traza) ----------
    async alConfirmarReserva(evento) {
      const { pedidoId, unidades } = evento.datos;
      if (!(await repo.buscarPedido(pedidoId))) return;
      await repo.agregarPaso({ pedidoId, ...paso("inventario", "stock confirmado", `${unidades ?? ""} uds descontadas del inventario`.trim(), "EVENTO", evento.correlationId) });
    },

    async alLiberarReserva(evento) {
      const { pedidoId, motivo } = evento.datos;
      const pedido = await repo.buscarPedido(pedidoId);
      if (!pedido) return;
      await repo.agregarPaso({ pedidoId, ...paso("inventario", `reserva liberada (${MOTIVOS_LIBERACION[motivo] || motivo})`, "Las unidades vuelven a estar disponibles", "EVENTO", evento.correlationId) });
      if (motivo === "vencida" && pedido.estado === "PENDIENTE_PAGO") {
        await repo.transicionarPedido({
          pedidoId, desde: ["PENDIENTE_PAGO"], hacia: "CANCELADO", estadoSubpedidos: "CANCELADO",
          motivo: "La reserva venció: pasaron 15 minutos sin pago",
          pasos: [paso("pedidos-pagos", "pedido cancelado", "Reserva vencida sin pago", "EVENTO", evento.correlationId)],
        });
      }
    },

    async alEnviarNotificacion(evento) {
      const { pedidoId, destinatarios = [], eventoOrigen } = evento.datos;
      if (!pedidoId || !(await repo.buscarPedido(pedidoId))) return;
      const roles = new Set(destinatarios.map((d) => d.rol));
      const quienes = roles.has("cliente") && roles.has("vendedor") ? "cliente y vendedor avisados"
        : roles.has("vendedor") ? "vendedor avisado" : "cliente avisado";
      await repo.agregarPaso({ pedidoId, ...paso("notificaciones", quienes, eventoOrigen ? `por ${eventoOrigen}` : null, "EVENTO", evento.correlationId) });
    },

    // ---------- Métricas ----------
    async metricas() {
      const pedidos = await repo.listarParaMetricas();
      const pedidosPorEstado = {};
      const porVendedor = new Map();
      const porCategoria = new Map();
      const porDia = new Map();
      for (let i = 13; i >= 0; i--) porDia.set(diaBogota(Date.now() - i * 86400000), { fecha: null, total: 0, pedidos: 0 });
      let ventasTotales = 0;

      for (const p of pedidos) {
        pedidosPorEstado[p.estado] = (pedidosPorEstado[p.estado] || 0) + 1;
        const vendidos = p.subpedidos.filter((s) => ESTADOS_VENDIDOS.includes(s.estado));
        if (!vendidos.length) continue;
        const dia = porDia.get(diaBogota(p.creadoEn));
        for (const s of vendidos) {
          ventasTotales += s.subtotal;
          const v = porVendedor.get(s.nombreTienda) || { nombreTienda: s.nombreTienda, total: 0, unidades: 0 };
          v.total += s.subtotal; v.unidades += s.unidades;
          porVendedor.set(s.nombreTienda, v);
          for (const it of s.items) {
            const clave = it.categoria || "otros";
            const c = porCategoria.get(clave) || { categoria: clave, total: 0, unidades: 0 };
            c.total += it.subtotal; c.unidades += it.cantidad;
            porCategoria.set(clave, c);
          }
          if (dia) dia.total += s.subtotal;
        }
        if (dia) dia.pedidos += 1;
      }
      const porTotal = (a, b) => b.total - a.total;
      return {
        ventasTotales,
        pedidosTotales: pedidos.length,
        pedidosPorEstado,
        ventasPorVendedor: [...porVendedor.values()].sort(porTotal),
        ventasPorCategoria: [...porCategoria.values()].sort(porTotal),
        ventasPorDia: [...porDia.entries()].map(([fecha, d]) => ({ fecha, total: d.total, pedidos: d.pedidos })),
      };
    },

    async metricasVendedor(usuario) {
      const pedidos = await repo.listarParaMetricas();
      const hoy = diaBogota(Date.now());
      const subs = pedidos.flatMap((p) => p.subpedidos
        .filter((s) => s.vendedorUsuarioId === usuario.id)
        .map((s) => ({ ...s, pedidoId: p.id, codigo: p.codigo, clienteNombre: p.clienteNombre, creadoEn: p.creadoEn })));
      const vendidos = subs.filter((s) => ESTADOS_VENDIDOS.includes(s.estado));
      return {
        ventasHoy: vendidos.filter((s) => diaBogota(s.creadoEn) === hoy).reduce((t, s) => t + s.subtotal, 0),
        ventasTotales: vendidos.reduce((t, s) => t + s.subtotal, 0),
        unidadesVendidas: vendidos.reduce((t, s) => t + s.unidades, 0),
        porAtender: subs.filter((s) => s.estado === "PAGADO").length,
        enCamino: subs.filter((s) => ["PREPARANDO", "ENVIADO"].includes(s.estado)).length,
        entregados: subs.filter((s) => s.estado === "ENTREGADO").length,
        ultimosSubpedidos: subs.slice(0, 6).map((s) => ({
          pedidoId: s.pedidoId, subpedidoId: s.id, codigo: s.codigo, clienteNombre: s.clienteNombre, estado: s.estado,
          subtotal: s.subtotal, unidades: s.unidades, creadoEn: s.creadoEn,
        })),
      };
    },
  };
}
