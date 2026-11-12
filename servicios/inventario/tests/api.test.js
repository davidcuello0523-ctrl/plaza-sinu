import request from "supertest";
import { firmarAcceso } from "@plaza/compartido";
import { construirApp } from "../src/app.js";
import { VENDEDOR, busFalso, logger, repoEnMemoria, stocksDemo } from "./dobles.js";

const app = construirApp({ repo: repoEnMemoria(stocksDemo()), bus: busFalso(), logger, verificaciones: {} });
const token = (id, rol) => `Bearer ${firmarAcceso({ id, rol, nombre: "x", email: "x@x.co" })}`;
const dueno = token(VENDEDOR, "vendedor");
const otroVendedor = token("otro-vendedor", "vendedor");
const cliente = token("c1", "cliente");
const INTERNA = { "x-clave-interna": process.env.CLAVE_INTERNA || "clave-interna-dev" };

describe("API inventario", () => {
  test("GET /inventario/:id es público → 200 / 404", async () => {
    const r = await request(app).get("/inventario/prd-009").expect(200);
    expect(r.body).toMatchObject({ disponible: 2, estado: "ultimas_unidades" });
    await request(app).get("/inventario/no-existe").expect(404);
  });

  test("POST /inventario/disponibilidad: sin token → 401; con token → lote", async () => {
    const cuerpo = { items: [{ productoId: "prd-009", cantidad: 3 }, { productoId: "prd-008", cantidad: 1 }] };
    await request(app).post("/inventario/disponibilidad").send(cuerpo).expect(401);
    const r = await request(app).post("/inventario/disponibilidad").set("authorization", cliente).send(cuerpo).expect(200);
    expect(r.body.datos.map((d) => d.alcanza)).toEqual([false, true]);
    await request(app).post("/inventario/disponibilidad").set(INTERNA).send(cuerpo).expect(200);
  });

  test("PUT /inventario/:id: dueño 200, otro vendedor 403, cliente 403, negativo 422", async () => {
    await request(app).put("/inventario/prd-008").set("authorization", dueno).send({ fisico: 12, nota: "llegó mercancía" }).expect(200);
    await request(app).put("/inventario/prd-008").set("authorization", otroVendedor).send({ fisico: 1 }).expect(403);
    await request(app).put("/inventario/prd-008").set("authorization", cliente).send({ fisico: 1 }).expect(403);
    const r = await request(app).put("/inventario/prd-008").set("authorization", dueno).send({ fisico: -1 }).expect(422);
    expect(r.body.error.detalles[0].campo).toBe("fisico");
  });

  test("GET /inventario lista solo el stock del vendedor", async () => {
    const r = await request(app).get("/inventario").set("authorization", dueno).expect(200);
    expect(r.body.datos.map((s) => s.productoId).sort()).toEqual(["prd-008", "prd-009"]);
  });

  test("GET movimientos: dueño 200, otro 403", async () => {
    await request(app).get("/inventario/prd-008/movimientos").set("authorization", dueno).expect(200);
    await request(app).get("/inventario/prd-008/movimientos").set("authorization", otroVendedor).expect(403);
  });

  test("/reservas exige la clave interna → 403 sin ella", async () => {
    await request(app).post("/reservas").set("authorization", cliente)
      .send({ pedidoId: "p", items: [{ productoId: "prd-008", cantidad: 1 }] }).expect(403);
  });

  test("POST /reservas → 201, repetida → 200, sin stock → 409, inválida → 422", async () => {
    const cuerpo = { pedidoId: "ped-1", items: [{ productoId: "prd-009", cantidad: 2 }] };
    const r = await request(app).post("/reservas").set(INTERNA).send(cuerpo).expect(201);
    await request(app).post("/reservas").set(INTERNA).send(cuerpo).expect(200);
    const sin = await request(app).post("/reservas").set(INTERNA)
      .send({ pedidoId: "ped-2", items: [{ productoId: "prd-009", cantidad: 1 }] }).expect(409);
    expect(sin.body.error.codigo).toBe("STOCK_INSUFICIENTE");
    await request(app).post("/reservas").set(INTERNA).send({ pedidoId: "x", items: [] }).expect(422);

    await request(app).post(`/reservas/${r.body.id}/liberar`).set(INTERNA).send({ motivo: "cancelado" }).expect(200);
    await request(app).post(`/reservas/${r.body.id}/confirmar`).set(INTERNA).expect(409);
    await request(app).post("/reservas/no-existe/confirmar").set(INTERNA).expect(404);
  });
});
