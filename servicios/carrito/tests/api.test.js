import request from "supertest";
import { firmarAcceso } from "@plaza/compartido";
import { construirApp } from "../src/app.js";
import { registrarConsumidores } from "../src/eventos/consumidores.js";
import { clientesFalsos, logger, repoEnMemoria } from "./dobles.js";

const tokenDe = (id, rol) => `Bearer ${firmarAcceso({ id, rol, nombre: "X", email: `${id}@x.co` })}`;
const cliente = tokenDe("u11", "cliente");
const INTERNA = { "x-clave-interna": process.env.CLAVE_INTERNA || "clave-interna-dev" };

describe("API carrito", () => {
  let app, clientes, repo;
  beforeEach(() => {
    repo = repoEnMemoria();
    clientes = clientesFalsos();
    app = construirApp({ repo, clientes, logger, verificaciones: {} });
  });

  test("sin token → 401", async () => {
    const r = await request(app).get("/carrito").expect(401);
    expect(r.body.error.codigo).toBe("NO_AUTENTICADO");
  });

  test("un vendedor no puede comprar → 403", async () => {
    const r = await request(app).get("/carrito").set("authorization", tokenDe("u101", "vendedor")).expect(403);
    expect(r.body.error.mensaje).toBe("Solo los clientes pueden comprar");
  });

  test("GET /carrito vacío → 200", async () => {
    const r = await request(app).get("/carrito").set("authorization", cliente).expect(200);
    expect(r.body).toMatchObject({ grupos: [], total: 0, valido: true });
  });

  test("POST /carrito/items → 201 agrupado por vendedor; repetir incrementa", async () => {
    await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "prd-008", cantidad: 1 }).expect(201);
    await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "prd-029", cantidad: 1 }).expect(201);
    const r = await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "prd-008", cantidad: 2 }).expect(201);
    expect(r.body.grupos).toHaveLength(2);
    expect(r.body.unidades).toBe(4);
    expect(r.body.total).toBe(3 * 1850000 + 420000);
  });

  test("cantidad 0 o texto → 422", async () => {
    await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "prd-009", cantidad: 0 }).expect(422);
    const r = await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "prd-009", cantidad: "abc" }).expect(422);
    expect(r.body.error.detalles[0].campo).toBe("cantidad");
  });

  test("producto inexistente o no publicado → 404", async () => {
    await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "nada", cantidad: 1 }).expect(404);
    await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "prd-099", cantidad: 1 }).expect(404);
  });

  test("pedir más de lo disponible (sumando lo del carrito) → 409 STOCK_INSUFICIENTE", async () => {
    await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "prd-009", cantidad: 2 }).expect(201);
    const r = await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "prd-009", cantidad: 1 }).expect(409);
    expect(r.body.error).toMatchObject({ codigo: "STOCK_INSUFICIENTE", mensaje: "Solo quedan 2 unidades de Casco MTB ventilado" });
    expect(r.body.error.detalles[0]).toMatchObject({ productoId: "prd-009", disponible: 2, solicitado: 3 });
  });

  test("PATCH cambia la cantidad, valida stock y 404 si no está en el carrito", async () => {
    await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "prd-008", cantidad: 1 }).expect(201);
    const r = await request(app).patch("/carrito/items/prd-008").set("authorization", cliente).send({ cantidad: 4 }).expect(200);
    expect(r.body.unidades).toBe(4);
    await request(app).patch("/carrito/items/prd-008").set("authorization", cliente).send({ cantidad: 11 }).expect(409);
    await request(app).patch("/carrito/items/prd-029").set("authorization", cliente).send({ cantidad: 1 }).expect(404);
  });

  test("DELETE de un item → 200 / 404; DELETE /carrito → 204", async () => {
    await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "prd-008", cantidad: 1 }).expect(201);
    const r = await request(app).delete("/carrito/items/prd-008").set("authorization", cliente).expect(200);
    expect(r.body.grupos).toEqual([]);
    await request(app).delete("/carrito/items/prd-008").set("authorization", cliente).expect(404);
    await request(app).delete("/carrito").set("authorization", cliente).expect(204);
  });

  test("catálogo caído → 503 con mensaje claro", async () => {
    clientes.estado.catalogoCaido = true;
    const r = await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "prd-009", cantidad: 1 }).expect(503);
    expect(r.body.error.codigo).toBe("SERVICIO_NO_DISPONIBLE");
  });

  test("inventario caído → GET /carrito responde 200 pero no válido (degradación)", async () => {
    await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "prd-009", cantidad: 1 }).expect(201);
    clientes.estado.inventarioCaido = true;
    const r = await request(app).get("/carrito").set("authorization", cliente).expect(200);
    expect(r.body.valido).toBe(false);
    expect(r.body.avisos).toContain("No pudimos verificar el stock en este momento");
  });

  test("rutas internas exigen la clave interna", async () => {
    await request(app).post("/carrito/items").set("authorization", cliente).send({ productoId: "prd-009", cantidad: 1 }).expect(201);
    await request(app).get("/interno/carrito/u11").expect(403);
    const r = await request(app).get("/interno/carrito/u11").set(INTERNA).expect(200);
    expect(r.body.unidades).toBe(1);
    await request(app).delete("/interno/carrito/u11").set(INTERNA).expect(204);
    expect((await repo.obtener("u11")).items).toEqual([]);
  });

  test("evento pago.aprobado vacía el carrito del cliente (y un duplicado se ignora)", async () => {
    let suscripcion;
    registrarConsumidores({ bus: { consumir: (s) => { suscripcion = s; } }, repo });
    expect(suscripcion.claves).toEqual(["pago.aprobado"]);
    await repo.guardar("u11", [{ productoId: "prd-009", cantidad: 1, precioAlAgregar: 159000 }]);
    await suscripcion.manejador({ id: "e1", datos: { clienteId: "u11" } });
    await suscripcion.procesados.guardar("e1");
    expect((await repo.obtener("u11")).items).toEqual([]);
    expect(await suscripcion.procesados.existe("e1")).toBe(true);
  });
});
