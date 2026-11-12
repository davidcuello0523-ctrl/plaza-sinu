import request from "supertest";
import { construirApp } from "../src/app.js";
import { busFalso, logger, repoEnMemoria } from "./dobles.js";

const app = construirApp({ repo: repoEnMemoria(), bus: busFalso(), logger, verificaciones: {} });
const nuevo = { nombre: "Andrés", email: "andres@plaza.co", clave: "Clave1234" };

describe("API usuarios", () => {
  let token;

  test("POST /auth/registro → 201 con tokens", async () => {
    const res = await request(app).post("/auth/registro").send(nuevo).expect(201);
    expect(res.body.accessToken).toBeDefined();
    token = res.body.accessToken;
  });

  test("POST /auth/registro con datos inválidos → 422 con detalle por campo", async () => {
    const res = await request(app).post("/auth/registro").send({ email: "malo", clave: "123" }).expect(422);
    expect(res.body.error.codigo).toBe("VALIDACION");
    expect(res.body.error.detalles.map((d) => d.campo)).toEqual(expect.arrayContaining(["nombre", "email", "clave"]));
  });

  test("POST /auth/registro como admin no está permitido → 422", async () => {
    await request(app).post("/auth/registro").send({ ...nuevo, email: "x@plaza.co", rol: "admin" }).expect(422);
  });

  test("POST /auth/registro duplicado → 409", async () => {
    await request(app).post("/auth/registro").send(nuevo).expect(409);
  });

  test("POST /auth/login → 200 / clave mala → 401", async () => {
    await request(app).post("/auth/login").send({ email: nuevo.email, clave: nuevo.clave }).expect(200);
    const res = await request(app).post("/auth/login").send({ email: nuevo.email, clave: "mala" }).expect(401);
    expect(res.body.error.codigo).toBe("NO_AUTENTICADO");
  });

  test("JSON mal formado → 400", async () => {
    await request(app).post("/auth/login").set("content-type", "application/json").send("{malo").expect(400);
  });

  test("GET /usuarios/yo sin token → 401, con token → 200", async () => {
    await request(app).get("/usuarios/yo").expect(401);
    const res = await request(app).get("/usuarios/yo").set("authorization", `Bearer ${token}`).expect(200);
    expect(res.body.email).toBe(nuevo.email);
  });

  test("PATCH /usuarios/yo actualiza el perfil y rechaza campos extra (rol) → 422", async () => {
    const ok = await request(app).patch("/usuarios/yo").set("authorization", `Bearer ${token}`).send({ ciudad: "Cereté" }).expect(200);
    expect(ok.body.ciudad).toBe("Cereté");
    await request(app).patch("/usuarios/yo").set("authorization", `Bearer ${token}`).send({ rol: "admin" }).expect(422);
  });

  test("GET /usuarios con rol cliente → 403", async () => {
    await request(app).get("/usuarios").set("authorization", `Bearer ${token}`).expect(403);
  });

  test("ruta inexistente → 404 con formato común y correlationId", async () => {
    const res = await request(app).get("/nada").set("x-correlation-id", "abc-123").expect(404);
    expect(res.body.error.correlationId).toBe("abc-123");
  });

  test("GET /salud → 200", async () => {
    await request(app).get("/salud").expect(200);
  });
});
