// Capa de acceso a datos (Prisma). Las operaciones que tocan stock corren en
// UNA transacción y bloquean las filas con SELECT … FOR UPDATE: si dos clientes
// compran la última unidad a la vez, el segundo espera al primero y luego ve
// el stock ya descontado (nunca queda negativo).
import { agruparItems, disponible, puedeTransicionar, validarAjuste, validarReserva } from "../servicios/reglas.js";

const conItems = { items: { select: { productoId: true, cantidad: true } } };

// ORDER BY evita interbloqueos cuando dos reservas piden los mismos productos en distinto orden.
async function bloquearStocks(tx, productoIds) {
  const filas = await tx.$queryRaw`
    SELECT * FROM "Stock" WHERE "productoId" = ANY(${productoIds}) ORDER BY "productoId" FOR UPDATE`;
  return new Map(filas.map((f) => [f.productoId, f]));
}

async function bloquearReserva(tx, id) {
  await tx.$queryRaw`SELECT id FROM "Reserva" WHERE id = ${id} FOR UPDATE`;
  return tx.reserva.findUnique({ where: { id }, include: conItems });
}

async function movimiento(tx, stock, tipo, cantidad, referencia, nota) {
  await tx.movimiento.create({
    data: { productoId: stock.productoId, tipo, cantidad, saldoFisico: stock.fisico, saldoDisponible: disponible(stock), referencia, nota },
  });
}

export function crearRepositorioInventario(prisma) {
  // Cierra una reserva ACTIVA (confirmar o liberar) con sus efectos en el stock.
  async function cerrarReserva(id, destino, motivo) {
    return prisma.$transaction(async (tx) => {
      const reserva = await bloquearReserva(tx, id);
      if (!reserva) return null;
      if (!puedeTransicionar(reserva, destino)) return { reserva, cambiado: false, stocks: [] };
      await bloquearStocks(tx, reserva.items.map((i) => i.productoId));
      const stocks = [];
      for (const { productoId, cantidad } of reserva.items) {
        const data = destino === "CONFIRMADA"
          ? { fisico: { decrement: cantidad }, reservado: { decrement: cantidad } }
          : { reservado: { decrement: cantidad } };
        const s = await tx.stock.update({ where: { productoId }, data });
        await movimiento(tx, s, destino === "CONFIRMADA" ? "SALIDA" : "LIBERACION", cantidad, reserva.pedidoId, motivo);
        stocks.push(s);
      }
      const actualizada = await tx.reserva.update({
        where: { id },
        data: { estado: destino, motivoLiberacion: motivo ?? null },
        include: conItems,
      });
      return { reserva: actualizada, cambiado: true, stocks };
    });
  }

  return {
    obtener: (productoId) => prisma.stock.findUnique({ where: { productoId } }),
    obtenerVarios: (productoIds) => prisma.stock.findMany({ where: { productoId: { in: productoIds } } }),
    listar: (filtro = {}) => prisma.stock.findMany({ where: filtro, orderBy: { productoId: "asc" } }),
    movimientos: (productoId) =>
      prisma.movimiento.findMany({ where: { productoId }, orderBy: { creadoEn: "desc" }, take: 100 }),

    ajustar: (productoId, { fisico, umbral, nota, referencia }) =>
      prisma.$transaction(async (tx) => {
        const actual = (await bloquearStocks(tx, [productoId])).get(productoId);
        validarAjuste(actual, fisico);
        const s = await tx.stock.update({ where: { productoId }, data: { fisico, ...(umbral !== undefined && { umbral }) } });
        await movimiento(tx, s, "AJUSTE", fisico - actual.fisico, referencia, nota);
        return s;
      }),

    reservar: ({ pedidoId, items, venceEn }) =>
      prisma.$transaction(async (tx) => {
        const existente = await tx.reserva.findUnique({ where: { pedidoId }, include: conItems });
        if (existente) return { reserva: existente, nueva: false };
        const agrupados = agruparItems(items);
        const stocks = await bloquearStocks(tx, agrupados.map((i) => i.productoId));
        validarReserva(stocks, agrupados); // lanza 409 y la transacción se revierte
        const reserva = await tx.reserva.create({ data: { pedidoId, venceEn, items: { create: agrupados } }, include: conItems });
        for (const { productoId, cantidad } of agrupados) {
          const s = await tx.stock.update({ where: { productoId }, data: { reservado: { increment: cantidad } } });
          await movimiento(tx, s, "RESERVA", cantidad, pedidoId);
        }
        return { reserva, nueva: true };
      }),

    confirmar: (id) => cerrarReserva(id, "CONFIRMADA"),
    liberar: (id, motivo) => cerrarReserva(id, "LIBERADA", motivo),

    reservasVencidas: async (ahora) =>
      (await prisma.reserva.findMany({ where: { estado: "ACTIVA", venceEn: { lt: ahora } }, select: { id: true } })).map((r) => r.id),

    registrarProducto: ({ productoId, vendedorUsuarioId, nombreProducto }) =>
      prisma.stock.upsert({
        where: { productoId },
        create: { productoId, vendedorUsuarioId, nombreProducto, fisico: 0 },
        update: { vendedorUsuarioId, nombreProducto },
      }),

    procesados: {
      existe: async (id) => !!(await prisma.eventoProcesado.findUnique({ where: { id } })),
      guardar: (id, tipo) => prisma.eventoProcesado.create({ data: { id, tipo } }),
    },
  };
}
