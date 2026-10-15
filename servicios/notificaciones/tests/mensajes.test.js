// Pruebas UNITARIAS: cada evento produce las notificaciones correctas.
import { formatoCOP, notificacionesPara } from "../src/mensajes.js";

const ev = (tipo, datos) => ({ id: "e1", tipo, correlationId: "c1", datos });
const subpedidos = [
  { subpedidoId: "s1", vendedorId: "v1", vendedorUsuarioId: "uv1", nombreTienda: "Rueda Libre", unidades: 2, subtotal: 318000 },
  { subpedidoId: "s2", vendedorId: "v2", vendedorUsuarioId: "uv2", nombreTienda: "Tecno Sinú", unidades: 1, subtotal: 189000 },
];

describe("notificacionesPara", () => {
  test("formato COP colombiano", () => {
    expect(formatoCOP(1250000)).toBe("$ 1.250.000");
  });

  test("usuario.registrado (cliente) → bienvenida con correo simulado", () => {
    const [n, ...resto] = notificacionesPara(ev("usuario.registrado", { usuarioId: "u1", nombre: "Laura Petro", email: "l@x.co", rol: "cliente" }));
    expect(n.titulo).toBe("¡Bienvenida a Plaza Sinú, Laura!");
    expect(n.correo.para).toBe("l@x.co");
    expect(resto).toHaveLength(0);
  });

  test("usuario.registrado (vendedor) → también 'Solicita tu puesto'", () => {
    const lista = notificacionesPara(ev("usuario.registrado", { usuarioId: "u1", nombre: "Mario", rol: "vendedor" }));
    expect(lista.map((n) => n.titulo)).toContain("Solicita tu puesto");
  });

  test("vendedor.aprobado y vendedor.suspendido → al usuario del vendedor", () => {
    expect(notificacionesPara(ev("vendedor.aprobado", { usuarioId: "uv1", nombreTienda: "Tecno Sinú" }))[0])
      .toMatchObject({ usuarioId: "uv1", titulo: "Tu puesto Tecno Sinú fue aprobado" });
    expect(notificacionesPara(ev("vendedor.suspendido", { usuarioId: "uv1", nombreTienda: "Tecno Sinú" }))[0].titulo)
      .toContain("suspendido");
  });

  test("pedido.creado → aviso al cliente", () => {
    const lista = notificacionesPara(ev("pedido.creado", { pedidoId: "p1", codigo: "PS-000123", clienteId: "c1", total: 507000, unidades: 3, subpedidos }));
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ usuarioId: "c1", titulo: "Recibimos tu pedido PS-000123", pedidoId: "p1" });
  });

  test("pago.aprobado → cliente con últimos 4 + un aviso por vendedor", () => {
    const lista = notificacionesPara(ev("pago.aprobado", { pedidoId: "p1", codigo: "PS-000123", clienteId: "c1", total: 507000, marca: "VISA", ultimos4: "4242", subpedidos }));
    expect(lista).toHaveLength(3);
    expect(lista[0].titulo).toBe("Pago aprobado – pedido PS-000123");
    expect(lista[0].mensaje).toContain("•••• 4242");
    expect(lista[1]).toMatchObject({ usuarioId: "uv1", rol: "vendedor", titulo: "Nuevo pedido de 2 unidades — PS-000123" });
    expect(lista[2].titulo).toBe("Nuevo pedido de 1 unidad — PS-000123");
  });

  test("pago.rechazado → cliente, menciona que se liberaron los productos", () => {
    const [n] = notificacionesPara(ev("pago.rechazado", { pedidoId: "p1", codigo: "PS-000124", clienteId: "c1", motivo: "Fondos insuficientes" }));
    expect(n.titulo).toBe("Pago rechazado – PS-000124");
    expect(n.mensaje).toContain("se liberaron");
  });

  test("inventario.stock_bajo → al vendedor dueño", () => {
    const [n] = notificacionesPara(ev("inventario.stock_bajo", { productoId: "prd-009", nombreProducto: "Casco MTB ventilado", vendedorUsuarioId: "uv1", disponible: 1, umbral: 3 }));
    expect(n).toMatchObject({ usuarioId: "uv1", titulo: "Stock bajo: Casco MTB ventilado (quedan 1)" });
  });

  test("pedido.estado_cambiado → texto amigable para el cliente", () => {
    const [n] = notificacionesPara(ev("pedido.estado_cambiado", { pedidoId: "p1", codigo: "PS-000123", clienteId: "c1", nombreTienda: "Rueda Libre", estadoAnterior: "PREPARANDO", estadoNuevo: "ENVIADO" }));
    expect(n.titulo).toBe("Tu pedido PS-000123 de Rueda Libre está en camino");
  });

  test("evento desconocido → ninguna notificación", () => {
    expect(notificacionesPara(ev("otro.evento", {}))).toEqual([]);
  });
});
