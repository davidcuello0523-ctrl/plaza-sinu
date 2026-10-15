// Pruebas de API (Supertest) del servicio vendedores.
import request from "supertest";
import { firmarAcceso } from "@plaza/compartido";
import { construirApp } from "../src/app.js";
import { busFalso, logger, repoEnMemoria } from "./dobles.js";

const token = (id, rol) => `Bearer ${firmarAcceso({ id, rol, nombre: "x", email: `${id}@x.co` })}`;
const ADMIN = token("admin-1", "admin");
const VEND = token("u-vend", "vendedor");
const CLIENTE = token("u-cli", "cliente");
const aprobado = { id: "v-ok", usuarioId: "u-otro", nombreTienda: "Tecno Sinú", slug: "tecno-sinu", estado: "APROBADO",
  ciudad: "Montería", categoriaPrincipal: "tecnologia" };

const app = construirApp({ repo: repoEnMemoria([aprobado]), bus: busFalso(), logger, verificaciones: {} });
const solicitud = { nombreTienda: "Rueda Libre", categoriaPrincipal: "bicicletas", ciudad: "Montería", color: "#2F8F5B" };

describe("API vendedores", () => {
  let idNuevo;

  test("POST /vendedores/solicitudes sin token → 401; como cliente → 403", async () => {
    await request(app).post("/vendedores/solicitudes").send(solicitud).expect(401);
    await request(app).post("/vendedores/solicitudes").set("authorization", CLIENTE).send(solicitud).expect(403);
  });

  test("POST /vendedores/solicitudes inválida → 422", async () => {
    const r = await request(app).post("/vendedores/solicitudes").set("authorization", VEND)
      .send({ nombreTienda: "x", categoriaPrincipal: "comida", color: "rojo" }).expect(422);
    expect(r.body.error.detalles.map((d) => d.campo)).toEqual(expect.arrayContaining(["nombreTienda", "categoriaPrincipal", "ciudad", "color"]));
  });

  test("POST /vendedores/solicitudes → 201 PENDIENTE; repetir → 409", async () => {
    const r = await request(app).post("/vendedores/solicitudes").set("authorization", VEND).send(solicitud).expect(201);
    expect(r.body.estado).toBe("PENDIENTE");
    idNuevo = r.body.id;
    await request(app).post("/vendedores/solicitudes").set("authorization", VEND).send(solicitud).expect(409);
  });

  test("GET /vendedores público solo muestra aprobados", async () => {
    const r = await request(app).get("/vendedores").expect(200);
    expect(r.body.datos.map((v) => v.id)).toEqual(["v-ok"]);
  });

  test("GET /vendedores/:id pendiente: público 404, dueño 200", async () => {
    await request(app).get(`/vendedores/${idNuevo}`).expect(404);
    await request(app).get(`/vendedores/${idNuevo}`).set("authorization", VEND).expect(200);
  });

  test("GET /vendedores/yo y PATCH /vendedores/yo", async () => {
    await request(app).get("/vendedores/yo").set("authorization", VEND).expect(200);
    const r = await request(app).patch("/vendedores/yo").set("authorization", VEND).send({ color: "#16324F" }).expect(200);
    expect(r.body.color).toBe("#16324F");
    await request(app).patch("/vendedores/yo").set("authorization", VEND).send({ estado: "APROBADO" }).expect(422);
  });

  test("PATCH /vendedores/:id/estado: vendedor → 403, admin → 200, id inexistente → 404", async () => {
    await request(app).patch(`/vendedores/${idNuevo}/estado`).set("authorization", VEND).send({ estado: "APROBADO" }).expect(403);
    const r = await request(app).patch(`/vendedores/${idNuevo}/estado`).set("authorization", ADMIN).send({ estado: "APROBADO" }).expect(200);
    expect(r.body.estado).toBe("APROBADO");
    await request(app).patch("/vendedores/nada/estado").set("authorization", ADMIN).send({ estado: "APROBADO" }).expect(404);
  });

  test("rutas internas exigen la clave interna", async () => {
    await request(app).get("/interno/vendedores/por-usuario/u-vend").expect(403);
    const r = await request(app).get("/interno/vendedores/por-usuario/u-vend")
      .set("x-clave-interna", process.env.CLAVE_INTERNA || "clave-interna-dev").expect(200);
    expect(r.body.nombreTienda).toBe("Rueda Libre");
    await request(app).get("/interno/vendedores/v-ok").set("x-clave-interna", "clave-interna-dev").expect(200);
  });
});
