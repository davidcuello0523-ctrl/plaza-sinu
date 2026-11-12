import request from "supertest";
import { crearLogger, firmarAcceso } from "@plaza/compartido";
import { construirGateway } from "../src/app.js";
import { esPublica, servicioDe } from "../src/rutas.js";

const monitor = { registrarHttp() {}, saludAgregada: async () => ({ estado: "ok" }), recientes: () => [], colas: async () => [], stream() {} };
const app = construirGateway({ logger: crearLogger("pruebas"), monitor });
const tokenCliente = firmarAcceso({ id: "u1", rol: "cliente", nombre: "C", email: "c@x.co" });

describe("tabla de rutas", () => {
  test("cada prefijo va a su servicio", () => {
    expect(servicioDe("/auth/login")).toBe("usuarios");
    expect(servicioDe("/productos/abc")).toBe("catalogo");
    expect(servicioDe("/pedidos/1/traza")).toBe("pedidos-pagos");
    expect(servicioDe("/reservas")).toBeUndefined();
  });
  test("rutas públicas explícitas", () => {
    expect(esPublica("GET", "/productos")).toBe(true);
    expect(esPublica("GET", "/vendedores/yo")).toBe(false);
    expect(esPublica("POST", "/productos")).toBe(false);
    expect(esPublica("GET", "/carrito")).toBe(false);
  });
});

describe("gateway HTTP", () => {
  test("ruta protegida sin token → 401", async () => {
    const r = await request(app).get("/carrito").expect(401);
    expect(r.body.error.codigo).toBe("NO_AUTENTICADO");
  });
  test("token alterado → 401", async () => {
    await request(app).get("/carrito").set("authorization", `Bearer ${tokenCliente}x`).expect(401);
  });
  test("ruta interna o /reservas desde fuera → 404", async () => {
    await request(app).get("/carrito/interno/u1").set("authorization", `Bearer ${tokenCliente}`).expect(404);
    await request(app).post("/reservas").expect(404);
  });
  test("panel de monitoreo con rol cliente → 403", async () => {
    await request(app).get("/monitor/eventos").set("authorization", `Bearer ${tokenCliente}`).expect(403);
  });
  test("servicio caído → 503 con mensaje claro", async () => {
    const r = await request(app).get("/carrito").set("authorization", `Bearer ${tokenCliente}`);
    expect(r.status).toBe(503);
    expect(r.body.error.codigo).toBe("SERVICIO_NO_DISPONIBLE");
  });
});
