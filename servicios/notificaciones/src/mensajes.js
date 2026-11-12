export const formatoCOP = (valor) => `$ ${Math.round(valor || 0).toLocaleString("es-CO")}`;

const ESTADOS_AMIGABLES = {
  PAGADO: "pagado",
  PREPARANDO: "en preparación",
  ENVIADO: "en camino",
  ENTREGADO: "entregado",
  CANCELADO: "cancelado",
};

const primerNombre = (nombre = "") => nombre.trim().split(/\s+/)[0] || "";

export function notificacionesPara(evento) {
  const d = evento.datos || {};
  const pedido = (n) => ({ pedidoId: d.pedidoId, codigoPedido: d.codigo, ...n });

  switch (evento.tipo) {
    case "usuario.registrado": {
      const nombre = primerNombre(d.nombre);
      const lista = [{
        usuarioId: d.usuarioId, rol: d.rol, tipo: "bienvenida",
        titulo: `¡Bienvenida a Plaza Sinú, ${nombre}!`,
        mensaje: "Ya puedes recorrer los puestos de Córdoba y comprar a varias tiendas en un solo carrito.",
        enlace: "/catalogo",
        correo: { para: d.email, asunto: "Bienvenida a Plaza Sinú" },
      }];
      if (d.rol === "vendedor") {
        lista.push({
          usuarioId: d.usuarioId, rol: d.rol, tipo: "puesto",
          titulo: "Solicita tu puesto",
          mensaje: "Completa la solicitud de tu tienda; un administrador la revisará para que empieces a vender.",
          enlace: "/mi-puesto",
        });
      }
      return lista;
    }

    case "vendedor.aprobado":
      return [{
        usuarioId: d.usuarioId, rol: "vendedor", tipo: "puesto",
        titulo: `Tu puesto ${d.nombreTienda} fue aprobado`,
        mensaje: "Ya puedes publicar productos y recibir pedidos.",
        enlace: "/mi-puesto",
        correo: { asunto: "Tu puesto fue aprobado" },
      }];

    case "vendedor.suspendido":
      return [{
        usuarioId: d.usuarioId, rol: "vendedor", tipo: "puesto",
        titulo: `Tu puesto ${d.nombreTienda} fue suspendido`,
        mensaje: "Tus productos quedaron ocultos del catálogo. Comunícate con la administración.",
        enlace: "/mi-puesto",
        correo: { asunto: "Tu puesto fue suspendido" },
      }];

    case "pedido.creado":
      return [pedido({
        usuarioId: d.clienteId, rol: "cliente", tipo: "pedido",
        titulo: `Recibimos tu pedido ${d.codigo}`,
        mensaje: `${d.unidades ?? ""} unidad(es) por ${formatoCOP(d.total)}. Tus productos quedan reservados 15 minutos mientras pagas.`.trim(),
        enlace: `/pedidos/${d.pedidoId}`,
      })];

    case "pago.aprobado":
      return [
        pedido({
          usuarioId: d.clienteId, rol: "cliente", tipo: "pago",
          titulo: `Pago aprobado – pedido ${d.codigo}`,
          mensaje: `Pagaste ${formatoCOP(d.total)} con ${d.marca || "tarjeta"} •••• ${d.ultimos4}. Los vendedores ya están preparando tu pedido.`,
          enlace: `/pedidos/${d.pedidoId}`,
          correo: { asunto: `Pago aprobado ${d.codigo}` },
        }),
        ...(d.subpedidos || []).map((s) => pedido({
          usuarioId: s.vendedorUsuarioId, rol: "vendedor", tipo: "pedido",
          titulo: `Nuevo pedido de ${s.unidades} unidad${s.unidades === 1 ? "" : "es"} — ${d.codigo}`,
          mensaje: `${s.nombreTienda}: sub-pedido pagado por ${formatoCOP(s.subtotal)}. Prepáralo para el envío.`,
          enlace: "/mi-puesto/pedidos",
          correo: { asunto: `Nuevo pedido ${d.codigo}` },
        })),
      ];

    case "pago.rechazado":
      return [pedido({
        usuarioId: d.clienteId, rol: "cliente", tipo: "pago",
        titulo: `Pago rechazado – ${d.codigo}`,
        mensaje: `${d.motivo || "La pasarela rechazó el pago"}. Tus productos se liberaron; puedes intentar de nuevo desde el carrito.`,
        enlace: `/pedidos/${d.pedidoId}`,
      })];

    case "inventario.stock_bajo":
      return [{
        usuarioId: d.vendedorUsuarioId, rol: "vendedor", tipo: "stock",
        titulo: `Stock bajo: ${d.nombreProducto || d.productoId} (quedan ${d.disponible})`,
        mensaje: `Llegó al umbral de ${d.umbral} unidades. Ajusta tu inventario para no quedarte sin ventas.`,
        enlace: "/mi-puesto/inventario",
      }];

    case "pedido.estado_cambiado": {
      const estado = ESTADOS_AMIGABLES[d.estadoNuevo] || String(d.estadoNuevo || "").toLowerCase();
      return [pedido({
        usuarioId: d.clienteId, rol: "cliente", tipo: "envio",
        titulo: `Tu pedido ${d.codigo} de ${d.nombreTienda} está ${estado}`,
        mensaje: d.estadoNuevo === "ENTREGADO"
          ? "¡Gracias por comprar en Plaza Sinú!"
          : `${d.nombreTienda} actualizó tu sub-pedido.`,
        enlace: `/pedidos/${d.pedidoId}`,
      })];
    }

    default:
      return [];
  }
}

export const TIPOS_CONSUMIDOS = [
  "usuario.registrado", "vendedor.aprobado", "vendedor.suspendido", "pedido.creado",
  "pago.aprobado", "pago.rechazado", "inventario.stock_bajo", "pedido.estado_cambiado",
];
