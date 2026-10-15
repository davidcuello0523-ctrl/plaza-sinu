// Pruebas de API (Supertest) + procesamiento de eventos y push SSE.
import request from "supertest";
import { firmarAcceso } from "@plaza/compartido";
import { construirApp } from "../src/app.js";
import { crearHub } from "../src/hub.js";
import { busFalso, logger, repoEnMemoria, respuestaFalsa } from "./dobles.js";

const token = (id, rol = "cliente") => `Bearer ${firmarAcceso({ id, rol, nombre: "X", email: `${id}@x.co` })}`;

describe("servicio notificaciones", () => {
  let repo, bus, hub, app, servicio;
  beforeEach(() => {
    repo = repoEnMemoria();
    bus = busFalso();
    hub = crearHub();
    app = construirApp({ repo, bus, logger, hub, verificaciones: {} });
    servicio = app.locals.servicio;
  });

  const pagoAprobado = {
    id: "ev-1", tipo: "pago.aprobado", correlationId: "corr-1",
    datos: { pedidoId: "p1", codigo: "PS-000123", clienteId: "c1", total: 159000, marca: "VISA", ultimos4: "4242",
      subpedidos: [{ subpedidoId: "s1", vendedorUsuarioId: "uv1", nombreTienda: "Rueda Libre", unidades: 1, subtotal: 159000 }] },
  };

  test("procesar un evento guarda, empuja por SSE, simula correo y publica notificacion.enviada", async () => {
    const res = respuestaFalsa();
    hub.conectar("c1", res);
    expect(await servicio.procesarEvento(pagoAprobado)).toBe(2);
    expect(repo.notificaciones.map((n) => n.usuarioId)).toEqual(["c1", "uv1"]);
    expect(res.escrito[0]).toMatch(/^event: notificacion\ndata: .*Pago aprobado/);
    expect(repo.correos).toHaveLength(2);
    expect(bus.publicados[0]).toMatchObject({ tipo: "notificacion.enviada", datos: { pedidoId: "p1" }, opciones: { correlationId: "corr-1" } });
  });

  test("eventos sin pedidoId no publican notificacion.enviada", async () => {
    await servicio.procesarEvento({ id: "ev-2", tipo: "usuario.registrado", datos: { usuarioId: "c1", nombre: "Laura", rol: "cliente" } });
    expect(bus.publicados).toHaveLength(0);
  });

  test("el hub deja de enviar a una conexión cerrada", () => {
    const res = respuestaFalsa();
    const desconectar = hub.conectar("c1", res);
    desconectar();
    hub.enviar("c1", "notificacion", {});
    expect(res.escrito).toHaveLength(0);
    expect(hub.conectados()).toBe(0);
  });

  test("GET /notificaciones sin token → 401", async () => {
    await request(app).get("/notificaciones").expect(401);
  });

  test("GET /notificaciones devuelve solo las propias, paginadas y con contador noLeidas", async () => {
    await servicio.procesarEvento(pagoAprobado);
    const r = await request(app).get("/notificaciones?porPagina=10").set("authorization", token("c1")).expect(200);
    expect(r.body).toMatchObject({ total: 1, noLeidas: 1, pagina: 1, porPagina: 10, totalPaginas: 1 });
    expect(r.body.datos[0].usuarioId).toBe("c1");
  });

  test("query inválida → 422", async () => {
    await request(app).get("/notificaciones?porPagina=500").set("authorization", token("c1")).expect(422);
  });

  test("PATCH /:id/leida: dueño 200, otro usuario 403, inexistente 404", async () => {
    await servicio.procesarEvento(pagoAprobado);
    const id = repo.notificaciones[0].id;
    await request(app).patch(`/notificaciones/${id}/leida`).set("authorization", token("uv1", "vendedor")).expect(403);
    const r = await request(app).patch(`/notificaciones/${id}/leida`).set("authorization", token("c1")).expect(200);
    expect(r.body.leida).toBe(true);
    await request(app).patch("/notificaciones/no-existe/leida").set("authorization", token("c1")).expect(404);
  });

  test("PATCH /leer-todas marca todas las propias", async () => {
    await servicio.procesarEvento(pagoAprobado);
    await servicio.procesarEvento({ ...pagoAprobado, id: "ev-3" });
    const r = await request(app).patch("/notificaciones/leer-todas").set("authorization", token("c1")).expect(200);
    expect(r.body).toEqual({ actualizadas: 2 });
    const l = await request(app).get("/notificaciones?noLeidas=1").set("authorization", token("c1")).expect(200);
    expect(l.body.total).toBe(0);
  });

  test("GET /notificaciones/stream responde text/event-stream y saluda con 'hola'", async () => {
    const servidor = app.listen(0);
    const { port } = servidor.address();
    const t = token("c1").slice(7);
    const ctrl = new AbortController();
    const res = await fetch(`http://127.0.0.1:${port}/notificaciones/stream?token=${t}`, { signal: ctrl.signal });
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    const lector = res.body.getReader();
    let texto = "";
    while (!texto.includes("event: hola")) texto += new TextDecoder().decode((await lector.read()).value);
    expect(texto).toContain('"noLeidas":0');
    ctrl.abort();
    await new Promise((r) => servidor.close(r));
  });

  test("GET /salud → 200", async () => {
    await request(app).get("/salud").expect(200);
  });
});
