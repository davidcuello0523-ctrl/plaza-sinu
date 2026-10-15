// Capa de acceso a datos (Prisma). Es la ÚNICA que conoce la base de datos.
import { ErrorConflicto } from "@plaza/compartido";
import { codigoPedido } from "../servicios/dominio.js";

const incluirTodo = {
  subpedidos: { include: { items: true }, orderBy: { nombreTienda: "asc" } },
  pagos: { orderBy: { creadoEn: "asc" } },
};

export function crearRepositorioPedidos(prisma) {
  return {
    buscarPorIdempotencia: (clienteId, idempotencyKey) =>
      prisma.pedido.findUnique({ where: { clienteId_idempotencyKey: { clienteId, idempotencyKey } }, include: incluirTodo }),

    // upsert atómico: dos pedidos simultáneos nunca reciben el mismo código.
    async siguienteCodigo() {
      const c = await prisma.contador.upsert({
        where: { nombre: "pedido" },
        create: { nombre: "pedido", valor: 123 },
        update: { valor: { increment: 1 } },
      });
      return codigoPedido(c.valor);
    },

    // Crea pedido + sub-pedidos + items + pasos de traza en UNA sola operación.
    async crearPedido({ subpedidos, pasos, ...pedido }) {
      try {
        return await prisma.pedido.create({
          data: {
            ...pedido,
            subpedidos: { create: subpedidos.map(({ items, ...s }) => ({ ...s, items: { create: items } })) },
            pasos: { create: pasos },
          },
          include: incluirTodo,
        });
      } catch (e) {
        if (e.code === "P2002") throw new ErrorConflicto("Pedido duplicado para esa Idempotency-Key", "IDEMPOTENCIA");
        throw e;
      }
    },

    buscarPedido: (id) => prisma.pedido.findUnique({ where: { id }, include: incluirTodo }),

    async listarPedidos({ clienteId, vendedorUsuarioId, estado, pagina, porPagina }) {
      const where = {
        ...(clienteId && { clienteId }),
        ...(vendedorUsuarioId && { subpedidos: { some: { vendedorUsuarioId } } }),
        ...(estado && { estado }),
      };
      const [datos, total] = await prisma.$transaction([
        prisma.pedido.findMany({
          where,
          include: {
            ...incluirTodo,
            subpedidos: { ...incluirTodo.subpedidos, ...(vendedorUsuarioId && { where: { vendedorUsuarioId } }) },
          },
          orderBy: { creadoEn: "desc" },
          skip: (pagina - 1) * porPagina,
          take: porPagina,
        }),
        prisma.pedido.count({ where }),
      ]);
      return { datos, total };
    },

    // Cambio de estado CONDICIONAL y atómico: solo si el pedido sigue en uno de
    // los estados "desde". Evita, p. ej., cobrar dos veces el mismo pedido.
    transicionarPedido: ({ pedidoId, desde, hacia, estadoSubpedidos, motivo, pasos = [], pago }) =>
      prisma.$transaction(async (tx) => {
        const { count } = await tx.pedido.updateMany({
          where: { id: pedidoId, estado: { in: desde } },
          data: { estado: hacia, ...(motivo !== undefined && { motivo }) },
        });
        if (count === 0) return false;
        if (estadoSubpedidos) await tx.subPedido.updateMany({ where: { pedidoId }, data: { estado: estadoSubpedidos } });
        if (pago) await tx.pago.create({ data: { ...pago, pedidoId } });
        if (pasos.length) await tx.pasoTraza.createMany({ data: pasos.map((p) => ({ ...p, pedidoId })) });
        return true;
      }),

    async actualizarSubpedido({ subpedidoId, desde, hacia, paso }) {
      return prisma.$transaction(async (tx) => {
        const { count } = await tx.subPedido.updateMany({ where: { id: subpedidoId, estado: desde }, data: { estado: hacia } });
        if (count && paso) await tx.pasoTraza.create({ data: paso });
        return count > 0;
      });
    },

    agregarPaso: (paso) => prisma.pasoTraza.create({ data: paso }),
    listarPasos: (pedidoId) => prisma.pasoTraza.findMany({ where: { pedidoId }, orderBy: { ocurridoEn: "asc" } }),

    // shortcut: las métricas se calculan en memoria sobre todos los pedidos; con miles de pedidos → agregaciones SQL (groupBy)
    listarParaMetricas: () => prisma.pedido.findMany({ include: incluirTodo, orderBy: { creadoEn: "desc" } }),

    eventos: {
      existe: async (id) => (await prisma.eventoProcesado.count({ where: { id } })) > 0,
      guardar: (id, tipo) => prisma.eventoProcesado.create({ data: { id, tipo } }),
    },
  };
}
