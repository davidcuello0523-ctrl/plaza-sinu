// PRUEBAS DE RESILIENCIA (semiautomáticas: detienen y arrancan contenedores).
//  A. Notificaciones caído → se puede comprar; al volver, llegan las notificaciones pendientes.
//  B. Inventario caído → checkout responde 503 y no queda nada a medias.
//  C. Dos clientes compran la última unidad a la vez → solo uno la obtiene (409 al otro).
//  D. Token vencido / sin token / rol incorrecto → 401 / 401 / 403.
// Uso (raíz del repo, con todo arriba):  node pruebas/e2e/resiliencia.mjs
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import jwt from "jsonwebtoken";
import { api, crearReporte, esperar, login, nuevaClave } from "./util.mjs";

const r = crearReporte("Resultados de pruebas de resiliencia");
const compose = (args) => execSync(`docker compose ${args}`, { stdio: "pipe" }).toString();
const direccion = { nombreRecibe: "Prueba", telefono: "3000000000", ciudad: "Montería", direccion: "Calle 41 # 6-20" };
const tarjeta = { numeroTarjeta: "4242424242424242", titular: "PRUEBA", vencimiento: "12/29", cvv: "123" };

async function esperarSaludable(servicio) {
  return esperar(async () => {
    const s = await api("GET", "/salud");
    return s.datos?.servicios?.find((x) => x.nombre === servicio)?.estado === "ok";
  }, { msMax: 90000, cada: 1500 });
}

async function comprar(token, productoId, cantidad = 1) {
  await api("DELETE", "/carrito", { token });
  await api("POST", "/carrito/items", { token, cuerpo: { productoId, cantidad } });
  return api("POST", "/pedidos", { token, cuerpo: { direccion }, headers: { "idempotency-key": nuevaClave() } });
}

const cliente = await login("cliente2@plazasinu.co");
const admin = await login("admin@plazasinu.co");

// ---------- A. Notificaciones caído ----------
console.log("\n[A] docker compose stop notificaciones");
compose("stop notificaciones");
const p = await comprar(cliente, "prd-022");
const pago = await api("POST", `/pedidos/${p.datos?.id}/pagos`, { token: cliente, cuerpo: tarjeta });
r.verificar("A1. Con notificaciones caído se puede comprar y pagar", p.status === 201 && pago.status === 201, `pedido ${p.datos?.codigo} · pago ${pago.status}`);
const enCola = await esperar(async () => {
  const c = await api("GET", "/monitor/colas", { token: admin });
  const cola = c.datos?.datos?.find((q) => q.nombre === "notificaciones.eventos");
  return cola?.mensajes > 0 ? cola : null;
});
r.verificar("A2. Los eventos esperan en la cola notificaciones.eventos", enCola, `${enCola?.mensajes ?? 0} mensajes pendientes, ${enCola?.consumidores ?? "?"} consumidores`);
console.log("[A] docker compose start notificaciones");
compose("start notificaciones");
await esperarSaludable("notificaciones");
const llego = await esperar(async () => {
  const n = await api("GET", "/notificaciones", { token: cliente });
  return n.datos?.datos?.find((x) => x.pedidoId === p.datos?.id);
}, { msMax: 20000 });
r.verificar("A3. Al volver, las notificaciones pendientes llegan", llego, llego?.titulo);

// ---------- B. Inventario caído ----------
console.log("\n[B] docker compose stop inventario");
await api("DELETE", "/carrito", { token: cliente });
const agregado = await api("POST", "/carrito/items", { token: cliente, cuerpo: { productoId: "prd-023", cantidad: 1 } });
const pedidosAntes = (await api("GET", "/pedidos", { token: cliente })).datos?.total;
compose("stop inventario");
const b = await api("POST", "/pedidos", { token: cliente, cuerpo: { direccion }, headers: { "idempotency-key": nuevaClave() } });
r.verificar("B1. Checkout con inventario caído → 503 con mensaje claro", b.status === 503, `${b.status} · ${b.datos?.error?.mensaje}`);
const pedidosDespues = (await api("GET", "/pedidos", { token: cliente })).datos?.total;
r.verificar("B2. No queda ningún pedido a medias", agregado.status === 201 && pedidosAntes === pedidosDespues, `pedidos ${pedidosAntes} → ${pedidosDespues}`);
console.log("[B] docker compose start inventario");
compose("start inventario");
await esperarSaludable("inventario");
await api("DELETE", "/carrito", { token: cliente });

// ---------- C. Concurrencia sobre la última unidad ----------
const ULTIMA = "prd-003"; // Monitor 24": stock 1
const [c1, c2] = [await login("cliente3@plazasinu.co"), await login("cliente4@plazasinu.co")];
const s0 = (await api("GET", `/inventario/${ULTIMA}`)).datos;
for (const t of [c1, c2]) {
  await api("DELETE", "/carrito", { token: t });
  await api("POST", "/carrito/items", { token: t, cuerpo: { productoId: ULTIMA, cantidad: s0.disponible } });
}
const [x, y] = await Promise.all([c1, c2].map((t) =>
  api("POST", "/pedidos", { token: t, cuerpo: { direccion }, headers: { "idempotency-key": nuevaClave() } })));
const estados = [x.status, y.status].sort();
r.verificar("C1. Dos clientes compran la última unidad a la vez → solo uno la obtiene", estados[0] === 201 && estados[1] === 409,
  `respuestas ${estados.join(" y ")} · ${[x, y].find((z) => z.status === 409)?.datos?.error?.mensaje ?? ""}`);
// Dejar la demo como estaba: el ganador cancela y se libera la unidad.
const ganador = x.status === 201 ? { res: x, token: c1 } : { res: y, token: c2 };
await api("POST", `/pedidos/${ganador.res.datos?.id}/cancelar`, { token: ganador.token });
for (const t of [c1, c2]) await api("DELETE", "/carrito", { token: t });
const s1 = await esperar(async () => {
  const s = (await api("GET", `/inventario/${ULTIMA}`)).datos;
  return s.disponible === s0.disponible ? s : null;
});
r.verificar("C2. Al cancelar, la unidad vuelve a estar disponible", s1, `disponible ${s1?.disponible}`);

// ---------- D. Seguridad ----------
const secreto = readFileSync(".env", "utf8").match(/^JWT_SECRET=(.*)$/m)?.[1]?.trim();
const vencido = jwt.sign({ sub: "x", rol: "cliente", exp: Math.floor(Date.now() / 1000) - 60, iss: "plaza-sinu" }, secreto);
const d1 = await api("GET", "/carrito", { token: vencido });
r.verificar("D1. Token vencido → 401 'Tu sesión expiró'", d1.status === 401, d1.datos?.error?.mensaje);
const d2 = await api("GET", "/pedidos");
r.verificar("D2. Sin token → 401", d2.status === 401, d2.datos?.error?.mensaje);
const d3 = await api("PATCH", "/vendedores/00000000-0000-4000-c000-000000000008/estado", { token: cliente, cuerpo: { estado: "APROBADO" } });
r.verificar("D3. Cliente intenta aprobar un vendedor → 403", d3.status === 403, d3.datos?.error?.mensaje);
const d4 = await api("GET", "/usuarios", { token: cliente });
r.verificar("D4. Cliente intenta listar usuarios → 403", d4.status === 403, d4.datos?.error?.mensaje);

process.exit(r.guardar("docs/pruebas/resultados-resiliencia.md") ? 1 : 0);
