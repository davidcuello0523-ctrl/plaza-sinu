import request from "supertest";
import { firmarAcceso } from "@plaza/compartido";
import { construirApp } from "../src/app.js";
import {
  ADMIN, CLIENTE, OTRO_CLIENTE, VENDEDOR_A, VENDEDOR_B, busFalso, clientesFalsos, logger, repoEnMemoria,
} from "./dobles.js";

const token = (u) => `Bearer ${firmarAcceso(u)}`;
const direccion = { nombreRecibe: "Laura Petro", telefono: "300 123 4567", ciudad: "Montería", direccion: "Cra. 6 #28-14" };
const TARJETA_OK = { numeroTarjeta: "4242 4242 4242 4242", titular: "Laura Petro", vencimiento: "12/30", cvv: "123" };
const TARJETA_RECHAZO = { ...TARJETA_OK, numeroTarjeta: "4000 0000 0000 0002" };

function montar(opciones) {
  const repo = repoEnMemoria();
  const bus = busFalso();
  const clientes = clientesFalsos(opciones);
  const app = construirApp({ repo, bus, clientes, logger, verificaciones: {} });
  const checkout = (clave = "clave-1", u = CLIENTE) =>
    request(app).post("/pedidos").set("authorization", token(u)).set("idempotency-key", clave).send({ direccion });
  return { app, repo, bus, clientes, servicio: app.locals.servicio, checkout };
}

describe("POST /pedidos (checkout)", () => {
  test("sin Idempotency-Key → 400", async () => {
    const { app } = montar();
    const r = await request(app).post("/pedidos").set("authorization", token(CLIENTE)).send({ direccion }).expect(400);
    expect(r.body.error.codigo).toBe("PETICION_INVALIDA");
  });

  test("sin token → 401; vendedor intentando comprar → 403; dirección incompleta → 422", async () => {
    const { app } = montar();
    await request(app).post("/pedidos").send({ direccion }).expect(401);
    await request(app).post("/pedidos").set("authorization", token(VENDEDOR_A)).set("idempotency-key", "k").send({ direccion }).expect(403);
    const r = await request(app).post("/pedidos").set("authorization", token(CLIENTE)).set("idempotency-key", "k").send({ direccion: { ciudad: "M" } }).expect(422);
    expect(r.body.error.detalles.length).toBeGreaterThan(0);
  });

  test("crea el pedido PENDIENTE_PAGO con sub-pedidos por vendedor, reserva y traza; publica pedido.creado", async () => {
    const { checkout, bus, repo, clientes } = montar();
    const r = await checkout().expect(201);
    expect(r.body).toMatchObject({ codigo: "PS-000123", estado: "PENDIENTE_PAGO", total: 2 * 159000 + 420000, unidades: 3, reservaId: "res-1" });
    expect(r.body.subpedidos).toHaveLength(2);
    expect(clientes.llamadas.reservas[0].items).toEqual([{ productoId: "prd-1", cantidad: 2 }, { productoId: "prd-2", cantidad: 1 }]);
    expect(bus.publicados.map((e) => e.tipo)).toEqual(["pedido.creado"]);
    expect(bus.publicados[0].datos.subpedidos).toHaveLength(2);
    const pasos = await repo.listarPasos(r.body.id);
    expect(pasos.map((p) => p.servicio)).toEqual(["carrito", "catalogo", "pedidos-pagos", "inventario"]);
  });

  test("repetir con la misma Idempotency-Key devuelve el MISMO pedido (200) sin duplicar", async () => {
    const { checkout, repo, clientes } = montar();
    const a = await checkout("misma").expect(201);
    const b = await checkout("misma").expect(200);
    expect(b.body.id).toBe(a.body.id);
    expect(repo.pedidos.size).toBe(1);
    expect(clientes.llamadas.reservas).toHaveLength(1);
  });

  test("sin stock → 409 y el pedido queda RECHAZADO_SIN_STOCK", async () => {
    const { checkout, repo, bus } = montar({ inventario: "sin_stock" });
    const r = await checkout().expect(409);
    expect(r.body.error.codigo).toBe("STOCK_INSUFICIENTE");
    const { pedidoId } = r.body.error.detalles.find((d) => d.pedidoId);
    expect((await repo.buscarPedido(pedidoId)).estado).toBe("RECHAZADO_SIN_STOCK");
    expect(bus.publicados).toHaveLength(0);
  });

  test("inventario caído → 503 y NO se guarda nada", async () => {
    const { checkout, repo, bus } = montar({ inventario: "caido" });
    const r = await checkout().expect(503);
    expect(r.body.error.mensaje).toBe("Inventario no disponible, intenta en unos segundos");
    expect(repo.pedidos.size).toBe(0);
    expect(bus.publicados).toHaveLength(0);
  });

  test("carrito vacío → 422 CARRITO_VACIO", async () => {
    const { checkout } = montar({ items: [] });
    const r = await checkout().expect(422);
    expect(r.body.error.codigo).toBe("CARRITO_VACIO");
  });

  test("carrito con problemas de stock → 409 CARRITO_INVALIDO", async () => {
    const { checkout, clientes } = montar();
    clientes.llamadas.carritoValido = false;
    const r = await checkout().expect(409);
    expect(r.body.error.codigo).toBe("CARRITO_INVALIDO");
  });
});

describe("POST /pedidos/:id/pagos", () => {
  test("tarjeta 4242 → 201, pedido PAGADO, publica pago.aprobado y no guarda el número completo", async () => {
    const { app, checkout, bus, repo } = montar();
    const { body: pedido } = await checkout();
    const r = await request(app).post(`/pedidos/${pedido.id}/pagos`).set("authorization", token(CLIENTE)).send(TARJETA_OK).expect(201);
    expect(r.body.pedido.estado).toBe("PAGADO");
    expect(r.body.pedido.subpedidos.every((s) => s.estado === "PAGADO")).toBe(true);
    expect(r.body.pago).toMatchObject({ estado: "APROBADO", ultimos4: "4242", marca: "Visa" });
    expect(JSON.stringify(await repo.buscarPedido(pedido.id))).not.toContain("4242424242424242");
    expect(bus.publicados.at(-1)).toMatchObject({ tipo: "pago.aprobado", datos: { reservaId: "res-1", ultimos4: "4242" } });
    await request(app).post(`/pedidos/${pedido.id}/pagos`).set("authorization", token(CLIENTE)).send(TARJETA_OK).expect(409);
  });

  test("tarjeta 4000…0002 → 402 PAGO_RECHAZADO y publica pago.rechazado (compensación)", async () => {
    const { app, checkout, bus, repo } = montar();
    const { body: pedido } = await checkout();
    const r = await request(app).post(`/pedidos/${pedido.id}/pagos`).set("authorization", token(CLIENTE)).send(TARJETA_RECHAZO).expect(402);
    expect(r.body.error.codigo).toBe("PAGO_RECHAZADO");
    expect((await repo.buscarPedido(pedido.id)).estado).toBe("PAGO_RECHAZADO");
    expect(bus.publicados.at(-1)).toMatchObject({ tipo: "pago.rechazado", datos: { reservaId: "res-1" } });
  });

  test("otro cliente no puede pagar ni ver el pedido → 403; inexistente → 404", async () => {
    const { app, checkout } = montar();
    const { body: pedido } = await checkout();
    await request(app).post(`/pedidos/${pedido.id}/pagos`).set("authorization", token(OTRO_CLIENTE)).send(TARJETA_OK).expect(403);
    await request(app).get(`/pedidos/${pedido.id}`).set("authorization", token(OTRO_CLIENTE)).expect(403);
    await request(app).get("/pedidos/no-existe").set("authorization", token(CLIENTE)).expect(404);
  });

  test("tarjeta con formato inválido → 422", async () => {
    const { app, checkout } = montar();
    const { body: pedido } = await checkout();
    await request(app).post(`/pedidos/${pedido.id}/pagos`).set("authorization", token(CLIENTE)).send({ ...TARJETA_OK, cvv: "1" }).expect(422);
  });
});

describe("vendedor, consultas y traza", () => {
  async function pedidoPagado() {
    const ctx = montar();
    const { body } = await ctx.checkout();
    await request(ctx.app).post(`/pedidos/${body.id}/pagos`).set("authorization", token(CLIENTE)).send(TARJETA_OK);
    return { ...ctx, pedido: body };
  }

  test("el vendedor solo ve SU sub-pedido; el admin ve todos", async () => {
    const { app, pedido } = await pedidoPagado();
    const r = await request(app).get(`/pedidos/${pedido.id}`).set("authorization", token(VENDEDOR_A)).expect(200);
    expect(r.body.subpedidos.map((s) => s.nombreTienda)).toEqual(["Tienda A"]);
    const lista = await request(app).get("/pedidos").set("authorization", token(VENDEDOR_B)).expect(200);
    expect(lista.body.datos[0].subpedidos).toHaveLength(1);
    const admin = await request(app).get(`/pedidos/${pedido.id}`).set("authorization", token(ADMIN)).expect(200);
    expect(admin.body.subpedidos).toHaveLength(2);
  });

  test("el vendedor avanza su sub-pedido, se publica pedido.estado_cambiado; no puede tocar el de otro", async () => {
    const { app, pedido, bus } = await pedidoPagado();
    const subA = pedido.subpedidos.find((s) => s.nombreTienda === "Tienda A");
    const subB = pedido.subpedidos.find((s) => s.nombreTienda === "Tienda B");
    const avanzar = (u, subpedidoId, estado) =>
      request(app).patch(`/pedidos/${pedido.id}/estado`).set("authorization", token(u)).send({ subpedidoId, estado });

    await avanzar(VENDEDOR_A, subA.id, "PREPARANDO").expect(200);
    expect(bus.publicados.at(-1)).toMatchObject({ tipo: "pedido.estado_cambiado", datos: { estadoAnterior: "PAGADO", estadoNuevo: "PREPARANDO" } });
    await avanzar(VENDEDOR_A, subA.id, "ENTREGADO").expect(409);
    await avanzar(VENDEDOR_B, subA.id, "ENVIADO").expect(403);
    await avanzar(CLIENTE, subA.id, "ENVIADO").expect(403);
  });

  test("cuando todos los puestos entregan, el pedido pasa a COMPLETADO", async () => {
    const { app, pedido } = await pedidoPagado();
    for (const sub of pedido.subpedidos) {
      const vendedor = sub.nombreTienda === "Tienda A" ? VENDEDOR_A : VENDEDOR_B;
      for (const estado of ["PREPARANDO", "ENVIADO", "ENTREGADO"]) {
        await request(app).patch(`/pedidos/${pedido.id}/estado`).set("authorization", token(vendedor)).send({ subpedidoId: sub.id, estado }).expect(200);
      }
    }
    const r = await request(app).get(`/pedidos/${pedido.id}`).set("authorization", token(CLIENTE)).expect(200);
    expect(r.body.estado).toBe("COMPLETADO");
  });

  test("GET /pedidos/:id/traza incluye los pasos asíncronos (eventos) en orden", async () => {
    const { app, pedido, servicio } = await pedidoPagado();
    await servicio.alConfirmarReserva({ correlationId: "c1", datos: { pedidoId: pedido.id, unidades: 3 } });
    await servicio.alEnviarNotificacion({ correlationId: "c1", datos: { pedidoId: pedido.id, eventoOrigen: "pago.aprobado", destinatarios: [{ rol: "cliente" }, { rol: "vendedor" }] } });
    const r = await request(app).get(`/pedidos/${pedido.id}/traza`).set("authorization", token(CLIENTE)).expect(200);
    const acciones = r.body.pasos.map((p) => p.accion);
    expect(acciones).toEqual(expect.arrayContaining(["pago aprobado (•••• 4242)", "stock confirmado", "cliente y vendedor avisados"]));
    expect(r.body.pasos.at(-1).via).toBe("EVENTO");
  });

  test("cancelar libera la reserva; una reserva vencida cancela el pedido pendiente", async () => {
    const { app, checkout, clientes, servicio, repo } = montar();
    const { body: p1 } = await checkout("a");
    const r = await request(app).post(`/pedidos/${p1.id}/cancelar`).set("authorization", token(CLIENTE)).expect(200);
    expect(r.body.estado).toBe("CANCELADO");
    expect(clientes.llamadas.liberadas).toEqual(["/reservas/res-1/liberar"]);
    await request(app).post(`/pedidos/${p1.id}/cancelar`).set("authorization", token(CLIENTE)).expect(409);

    const { body: p2 } = await checkout("b");
    await servicio.alLiberarReserva({ correlationId: "c", datos: { pedidoId: p2.id, motivo: "vencida" } });
    expect((await repo.buscarPedido(p2.id)).estado).toBe("CANCELADO");
  });

  test("métricas: admin las ve, cliente → 403; vendedor ve las suyas", async () => {
    const { app } = await pedidoPagado();
    const r = await request(app).get("/metricas").set("authorization", token(ADMIN)).expect(200);
    expect(r.body.ventasTotales).toBe(738000);
    expect(r.body.ventasPorVendedor).toHaveLength(2);
    expect(r.body.ventasPorDia).toHaveLength(14);
    await request(app).get("/metricas").set("authorization", token(CLIENTE)).expect(403);
    const v = await request(app).get("/metricas/vendedor").set("authorization", token(VENDEDOR_A)).expect(200);
    expect(v.body).toMatchObject({ ventasHoy: 318000, porAtender: 1 });
  });
});
