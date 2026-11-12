import request from "supertest";
import { firmarAcceso } from "@plaza/compartido";
import { construirApp } from "../src/app.js";
import { busFalso, clienteVendedores, logger, producto, repoEnMemoria } from "./dobles.js";

const token = (id, rol) => `Bearer ${firmarAcceso({ id, rol, nombre: "x", email: `${id}@x.co` })}`;
const DUENO = token("u-bicis", "vendedor");
const OTRO = token("u-otro", "vendedor");
const PENDIENTE = token("u-pend", "vendedor");
const CLIENTE = token("u-cli", "cliente");
const ADMIN = token("admin", "admin");

const puestos = {
  "u-bicis": { id: "v2", estado: "APROBADO", nombreTienda: "Rueda Libre", color: "#2F8F5B", ciudad: "Montería" },
  "u-otro": { id: "v7", estado: "APROBADO", nombreTienda: "Deportes Ribera", color: "#C23B3B", ciudad: "Montería" },
  "u-pend": { id: "v8", estado: "PENDIENTE", nombreTienda: "Mercadito", color: "#6B7A2E", ciudad: "Tierralta" },
  "u-caido": "caido",
};
const bus = busFalso();
const repo = repoEnMemoria([producto(), producto({ id: "prd-oculto", publicado: false })]);
const app = construirApp({ repo, bus, clientes: { vendedores: clienteVendedores(puestos) }, logger, verificaciones: {} });
const nuevo = { nombre: "Bicicleta BMX rin 20", precio: 750000, categoria: "bicicletas", atributos: { rin: "20", cambios: "Single" } };

describe("API catálogo — lectura pública", () => {
  test("GET /productos devuelve paginación y oculta los no publicados", async () => {
    const r = await request(app).get("/productos?categoria=bicicletas").expect(200);
    expect(r.body).toMatchObject({ pagina: 1, porPagina: 12, total: 1, totalPaginas: 1 });
    expect(r.body.datos[0].id).toBe("prd-009");
  });

  test("GET /productos con filtros inválidos → 422", async () => {
    const r = await request(app).get("/productos?categoria=comida&precioMin=-5&orden=raro").expect(422);
    expect(r.body.error.detalles.map((d) => d.campo)).toEqual(expect.arrayContaining(["categoria", "precioMin", "orden"]));
  });

  test("GET /productos/:id → 200; oculto → 404 al público pero 200 al dueño", async () => {
    await request(app).get("/productos/prd-009").expect(200);
    await request(app).get("/productos/prd-oculto").expect(404);
    await request(app).get("/productos/prd-oculto").set("authorization", DUENO).expect(200);
    await request(app).get("/productos/no-existe").expect(404);
  });

  test("?mios=1 lista también los ocultos del vendedor", async () => {
    const r = await request(app).get("/productos?mios=1").set("authorization", DUENO).expect(200);
    expect(r.body.total).toBe(2);
  });

  test("GET /categorias y GET /productos/:id/imagen.svg", async () => {
    const c = await request(app).get("/categorias").expect(200);
    expect(c.body.datos).toHaveLength(7);
    const img = await request(app).get("/productos/prd-009/imagen.svg").expect(200);
    expect(img.headers["content-type"]).toMatch(/image\/svg\+xml/);
    expect(img.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });
});

describe("API catálogo — escritura", () => {
  let idNuevo;

  test("POST /productos sin token → 401; como cliente → 403", async () => {
    await request(app).post("/productos").send(nuevo).expect(401);
    await request(app).post("/productos").set("authorization", CLIENTE).send(nuevo).expect(403);
  });

  test("POST /productos con puesto pendiente → 403 con mensaje claro", async () => {
    const r = await request(app).post("/productos").set("authorization", PENDIENTE).send(nuevo).expect(403);
    expect(r.body.error.mensaje).toBe("Tu puesto aún no está aprobado");
  });

  test("POST /productos si vendedores no responde → 503", async () => {
    const tk = token("u-caido", "vendedor");
    await request(app).post("/productos").set("authorization", tk).send(nuevo).expect(503);
  });

  test("POST /productos inválido → 422 (precio con decimales, sin nombre)", async () => {
    const r = await request(app).post("/productos").set("authorization", DUENO).send({ precio: 10.5, categoria: "bicicletas" }).expect(422);
    expect(r.body.error.detalles.map((d) => d.campo)).toEqual(expect.arrayContaining(["nombre", "precio"]));
  });

  test("POST /productos → 201 con datos del puesto y publica producto.publicado", async () => {
    const r = await request(app).post("/productos").set("authorization", DUENO).send(nuevo).expect(201);
    idNuevo = r.body.id;
    expect(r.body).toMatchObject({ vendedorId: "v2", nombreTienda: "Rueda Libre", estadoStock: "agotado", imagenes: [`/productos/${idNuevo}/imagen.svg`] });
    expect(bus.publicados.at(-1)).toMatchObject({ tipo: "producto.publicado", datos: { productoId: idNuevo, vendedorUsuarioId: "u-bicis" } });
  });

  test("PUT /productos/:id: otro vendedor → 403; dueño → 200", async () => {
    await request(app).put(`/productos/${idNuevo}`).set("authorization", OTRO).send(nuevo).expect(403);
    const r = await request(app).put(`/productos/${idNuevo}`).set("authorization", DUENO).send({ ...nuevo, precio: 720000 }).expect(200);
    expect(r.body.precio).toBe(720000);
  });

  test("PATCH /productos/:id/publicacion: ocultar y volver a publicar emite el evento", async () => {
    await request(app).patch(`/productos/${idNuevo}/publicacion`).set("authorization", DUENO).send({ publicado: false }).expect(200);
    const antes = bus.publicados.length;
    await request(app).patch(`/productos/${idNuevo}/publicacion`).set("authorization", DUENO).send({ publicado: true }).expect(200);
    expect(bus.publicados.length).toBe(antes + 1);
    await request(app).patch(`/productos/${idNuevo}/publicacion`).set("authorization", DUENO).send({ publicado: "sí" }).expect(422);
  });

  test("DELETE /productos/:id: otro → 403, dueño → 204 (lógico), luego 404", async () => {
    await request(app).delete(`/productos/${idNuevo}`).set("authorization", OTRO).expect(403);
    await request(app).delete(`/productos/${idNuevo}`).set("authorization", DUENO).expect(204);
    expect(repo.datos.get(idNuevo).eliminado).toBe(true);
    await request(app).get(`/productos/${idNuevo}`).set("authorization", ADMIN).expect(404);
  });

  test("ruta interna /interno/productos exige clave y devuelve snapshot", async () => {
    await request(app).get("/interno/productos?ids=prd-009").expect(403);
    const r = await request(app).get("/interno/productos?ids=prd-009,nada").set("x-clave-interna", "clave-interna-dev").expect(200);
    expect(r.body.datos).toEqual([expect.objectContaining({ id: "prd-009", precio: 159000, vendedorUsuarioId: "u-bicis", publicado: true })]);
  });
});
