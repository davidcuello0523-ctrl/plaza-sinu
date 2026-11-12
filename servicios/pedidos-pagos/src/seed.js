import prismaPkg from "./generated/prisma/index.js";
import { calcularTotales, formatoCOP } from "./servicios/dominio.js";

const uid = (n) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const vid = (n) => `00000000-0000-4000-c000-${String(n).padStart(12, "0")}`;

const TIENDAS = {
  1: { vendedorId: vid(1), vendedorUsuarioId: uid(101), nombreTienda: "Tecno Sinú" },
  2: { vendedorId: vid(2), vendedorUsuarioId: uid(102), nombreTienda: "Rueda Libre" },
  5: { vendedorId: vid(5), vendedorUsuarioId: uid(105), nombreTienda: "Taller Zenú" },
};
const PRODUCTOS = {
  "prd-001": { nombre: 'Portátil Lenovo IdeaPad 15" Ryzen 5', precio: 2499000, categoria: "tecnologia", tienda: 1 },
  "prd-002": { nombre: "Audífonos inalámbricos Sinú Bass", precio: 189000, categoria: "tecnologia", tienda: 1 },
  "prd-003": { nombre: 'Monitor 24" Full HD', precio: 649000, categoria: "tecnologia", tienda: 1 },
  "prd-008": { nombre: "Bicicleta MTB rin 29 Shimano", precio: 1850000, categoria: "bicicletas", tienda: 2 },
  "prd-009": { nombre: "Casco MTB ventilado", precio: 159000, categoria: "bicicletas", tienda: 2 },
  "prd-029": { nombre: "Sombrero vueltiao 19 vueltas", precio: 420000, categoria: "artesanias", tienda: 5 },
  "prd-030": { nombre: "Mochila zenú en caña flecha", precio: 135000, categoria: "artesanias", tienda: 5 },
};
const CLIENTES = {
  11: { nombre: "Laura Petro", email: "cliente@plazasinu.co", ciudad: "Montería", dir: "Cra. 6 #28-14, barrio Centro" },
  12: { nombre: "Andrés Doria", email: "cliente2@plazasinu.co", ciudad: "Cereté", dir: "Calle 12 #9-40" },
  13: { nombre: "Valentina Hoyos", email: "cliente3@plazasinu.co", ciudad: "Lorica", dir: "Cra. 20 #4-31, Mercado" },
  14: { nombre: "Camilo Negrete", email: "cliente4@plazasinu.co", ciudad: "Sahagún", dir: "Calle 15 #11-02" },
};

const HISTORIA = [
  { n: 101, cliente: 11, dias: 9, items: [["prd-001", 1], ["prd-009", 1]], estado: "COMPLETADO", estadoSub: "ENTREGADO", pago: "ok" },
  { n: 102, cliente: 13, dias: 8, items: [["prd-001", 1], ["prd-030", 1]], estado: "COMPLETADO", estadoSub: "ENTREGADO", pago: "ok" },
  { n: 103, cliente: 12, dias: 6, items: [["prd-029", 1], ["prd-030", 2]], estado: "PAGADO", estadoSub: "ENVIADO", pago: "ok" },
  { n: 104, cliente: 14, dias: 5, items: [["prd-008", 1]], estado: "PAGO_RECHAZADO", estadoSub: "CANCELADO", pago: "rechazado", motivo: "Fondos insuficientes" },
  { n: 105, cliente: 13, dias: 3, items: [["prd-002", 2]], estado: "PAGADO", estadoSub: "PREPARANDO", pago: "ok" },
  { n: 106, cliente: 11, dias: 2, items: [["prd-003", 1]], estado: "CANCELADO", estadoSub: "CANCELADO", pago: null, motivo: "La reserva venció: pasaron 15 minutos sin pago" },
  { n: 107, cliente: 12, dias: 0.2, items: [["prd-009", 1], ["prd-002", 1]], estado: "PAGADO", estadoSub: "PAGADO", pago: "ok" },
];
const AVANCE = ["PAGADO", "PREPARANDO", "ENVIADO", "ENTREGADO"];

function construir(h) {
  const creadoEn = new Date(Date.now() - h.dias * 86400000);
  const t = (min) => new Date(creadoEn.getTime() + min * 60000);
  const c = CLIENTES[h.cliente];
  const codigo = `PS-${String(h.n).padStart(6, "0")}`;
  const correlationId = `seed-${codigo}`;
  const lineas = h.items.map(([id, cantidad]) => {
    const p = PRODUCTOS[id];
    return { productoId: id, nombre: p.nombre, categoria: p.categoria, imagen: `/productos/${id}/imagen.svg`, precioUnitario: p.precio, cantidad, ...TIENDAS[p.tienda] };
  });
  const { subpedidos, total, unidades } = calcularTotales(lineas);
  const paso = (min, servicio, accion, detalle, via = "REST") => ({ servicio, accion, detalle, via, correlationId, ocurridoEn: t(min) });

  const pasos = [
    paso(0, "carrito", "carrito leído y validado", `${unidades} uds de ${subpedidos.length} puesto(s)`),
    paso(0.01, "catalogo", "precios congelados en el pedido", `Total ${formatoCOP(total)}`),
    paso(0.02, "pedidos-pagos", `pedido ${codigo} creado`, `PENDIENTE_PAGO · ${formatoCOP(total)}`),
    paso(0.03, "inventario", `${unidades} uds reservadas por 15 min`, "Reserva de demostración"),
  ];
  const pagos = [];
  if (h.pago === "ok") {
    pagos.push({ estado: "APROBADO", marca: "Visa", ultimos4: "4242", titular: c.nombre, monto: total, referencia: `SIM-H${h.n}`, creadoEn: t(3) });
    pasos.push(paso(3, "pedidos-pagos", "pago aprobado (•••• 4242)", `Visa · ${formatoCOP(total)}`));
    pasos.push(paso(3.02, "inventario", "stock confirmado", `${unidades} uds descontadas del inventario`, "EVENTO"));
    pasos.push(paso(3.03, "notificaciones", "cliente y vendedor avisados", "por pago.aprobado", "EVENTO"));
    AVANCE.slice(1, AVANCE.indexOf(h.estadoSub) + 1).forEach((e, i) => {
      for (const s of subpedidos) pasos.push(paso(60 * 6 * (i + 1), "pedidos-pagos", `${s.nombreTienda}: ${e.toLowerCase()}`, `${AVANCE[i]} → ${e}`));
    });
    if (h.estado === "COMPLETADO") pasos.push(paso(60 * 20, "pedidos-pagos", "pedido completado", "Todos los puestos entregaron"));
  } else if (h.pago === "rechazado") {
    pagos.push({ estado: "RECHAZADO", marca: "Visa", ultimos4: "0002", titular: c.nombre, monto: total, referencia: `SIM-H${h.n}`, motivo: h.motivo, creadoEn: t(2) });
    pasos.push(paso(2, "pedidos-pagos", "pago rechazado (•••• 0002)", h.motivo));
    pasos.push(paso(2.02, "inventario", "reserva liberada (pago rechazado)", "Las unidades vuelven a estar disponibles", "EVENTO"));
  } else {
    pasos.push(paso(15, "inventario", "reserva liberada (venció sin pago)", "Las unidades vuelven a estar disponibles", "EVENTO"));
    pasos.push(paso(15.01, "pedidos-pagos", "pedido cancelado", "Reserva vencida sin pago", "EVENTO"));
  }

  return {
    codigo, clienteId: uid(h.cliente), clienteNombre: c.nombre, clienteEmail: c.email, estado: h.estado, total, unidades,
    direccion: { nombreRecibe: c.nombre, telefono: "300 000 0000", ciudad: c.ciudad, direccion: c.dir },
    idempotencyKey: `seed-${codigo}`, reservaId: null, correlationId, motivo: h.motivo ?? null, creadoEn,
    subpedidos: { create: subpedidos.map(({ items, ...s }) => ({ ...s, estado: h.estadoSub, items: { create: items } })) },
    pagos: { create: pagos },
    pasos: { create: pasos },
  };
}

export async function sembrar(prisma) {
  let creados = 0;
  for (const h of HISTORIA) {
    const datos = construir(h);
    if (await prisma.pedido.findUnique({ where: { codigo: datos.codigo } })) continue;
    await prisma.pedido.create({ data: datos });
    creados++;
  }
  await prisma.contador.upsert({ where: { nombre: "pedido" }, create: { nombre: "pedido", valor: 122 }, update: {} });
  return creados;
}

if (process.argv[1]?.endsWith("seed.js")) {
  const prisma = new prismaPkg.PrismaClient();
  const n = await sembrar(prisma);
  console.log(`pedidos-pagos: ${n} pedidos históricos sembrados`);
  await prisma.$disconnect();
}
