// PRUEBA E2E del flujo obligatorio, contra el gateway con todo levantado en Docker:
// iniciar sesión → consultar productos → agregar al carrito → generar pedido →
// actualizar inventario → registrar pago → generar notificación.
// Además: pago rechazado (compensación) y errores 401/403/404/409/422.
// Uso (desde la raíz del repo):  node pruebas/e2e/flujo-compra.mjs
import { api, crearReporte, esperar, login, nuevaClave } from "./util.mjs";

const r = crearReporte("Resultados E2E — flujo obligatorio de compra");
const PRODUCTO = "prd-008"; // Bicicleta MTB rin 29 (stock alto: la prueba se puede repetir)
const PRODUCTO_RECHAZO = "prd-002";
const direccion = { nombreRecibe: "Laura Petro", telefono: "3001234567", ciudad: "Montería", direccion: "Cra 9 # 27-15, barrio Centro" };

const stock = async (id) => (await api("GET", `/inventario/${id}`)).datos;

// 1. Iniciar sesión
const loginRes = await api("POST", "/auth/login", { cuerpo: { email: "cliente@plazasinu.co", clave: "Demo123*" } });
r.verificar("1. Iniciar sesión (usuarios emite JWT)", loginRes.status === 200 && loginRes.datos.accessToken, `status ${loginRes.status}`);
const token = loginRes.datos.accessToken;

// 2. Consultar productos
const catalogo = await api("GET", "/productos?categoria=bicicletas");
const bici = catalogo.datos?.datos?.find((p) => (p.id || p._id) === PRODUCTO);
r.verificar("2. Consultar productos (catálogo con estado de stock)", catalogo.status === 200 && bici?.estadoStock,
  `${catalogo.datos?.total} bicicletas · ${bici?.nombre} → ${bici?.estadoStock}`);

// 3. Agregar al carrito
await api("DELETE", "/carrito", { token });
const antes = await stock(PRODUCTO);
const agregar = await api("POST", "/carrito/items", { token, cuerpo: { productoId: PRODUCTO, cantidad: 2 } });
r.verificar("3. Agregar al carrito (valida precio y stock)", agregar.status === 201 && agregar.datos.unidades === 2,
  `status ${agregar.status} · total ${agregar.datos?.total}`);

// 4. Generar pedido (con Idempotency-Key)
const clave = nuevaClave();
const pedidoRes = await api("POST", "/pedidos", { token, cuerpo: { direccion }, headers: { "idempotency-key": clave } });
const pedido = pedidoRes.datos;
r.verificar("4. Generar pedido → PENDIENTE_PAGO", pedidoRes.status === 201 && pedido.estado === "PENDIENTE_PAGO",
  `status ${pedidoRes.status} · ${pedido?.codigo} · correlationId ${pedidoRes.correlationId}`);
const repetido = await api("POST", "/pedidos", { token, cuerpo: { direccion }, headers: { "idempotency-key": clave } });
r.verificar("4b. Repetir POST /pedidos con la misma Idempotency-Key no duplica", repetido.datos?.id === pedido.id,
  `status ${repetido.status} · mismo id`);

// 5. Actualizar inventario (reserva)
const reservado = await stock(PRODUCTO);
r.verificar("5. Inventario reserva las unidades", reservado.disponible === antes.disponible - 2 && reservado.fisico === antes.fisico,
  `disponible ${antes.disponible} → ${reservado.disponible} (físico ${reservado.fisico})`);

// 6. Registrar pago aprobado
const pago = await api("POST", `/pedidos/${pedido.id}/pagos`, {
  token, cuerpo: { numeroTarjeta: "4242 4242 4242 4242", titular: "LAURA PETRO", vencimiento: "12/29", cvv: "123" },
});
r.verificar("6. Registrar pago (tarjeta 4242 → aprobado)", pago.status === 201 && pago.datos?.pedido?.estado === "PAGADO",
  `status ${pago.status} · •••• ${pago.datos?.pago?.ultimos4}`);

// Consecuencias asíncronas (RabbitMQ): confirmación de stock, notificación, carrito vacío
const confirmado = await esperar(async () => {
  const s = await stock(PRODUCTO);
  return s.fisico === antes.fisico - 2 && s.reservado === antes.reservado ? s : null;
});
r.verificar("6b. pago.aprobado → inventario confirma (descuento definitivo)", confirmado,
  `físico ${antes.fisico} → ${confirmado?.fisico ?? "?"}`);

const notif = await esperar(async () => {
  const n = await api("GET", "/notificaciones", { token });
  return n.datos?.datos?.find((x) => x.pedidoId === pedido.id && /aprobado/i.test(x.titulo));
});
r.verificar("7. Generar notificación (cliente avisado por evento)", notif, notif?.titulo);

const tokenVendedor = await login("bicis@plazasinu.co");
const notifVendedor = await esperar(async () => {
  const n = await api("GET", "/notificaciones", { token: tokenVendedor });
  return n.datos?.datos?.find((x) => x.pedidoId === pedido.id);
});
r.verificar("7b. El vendedor recibe 'nuevo pedido'", notifVendedor, notifVendedor?.titulo);

const carritoVacio = await esperar(async () => ((await api("GET", "/carrito", { token })).datos?.unidades === 0 ? true : null));
r.verificar("7c. El carrito se vacía solo al aprobarse el pago", carritoVacio);

const traza = await esperar(async () => {
  const t = await api("GET", `/pedidos/${pedido.id}/traza`, { token });
  const servicios = new Set(t.datos?.pasos?.map((p) => p.servicio));
  return ["carrito", "inventario", "pedidos-pagos", "notificaciones"].every((s) => servicios.has(s)) ? t.datos : null;
});
r.verificar("7d. La traza del pedido muestra los servicios que participaron", traza,
  traza ? traza.pasos.map((p) => p.servicio).join(" → ") : "incompleta");

// Vendedor avanza su sub-pedido
const det = await api("GET", `/pedidos/${pedido.id}`, { token: tokenVendedor });
const sub = det.datos?.subpedidos?.[0];
const avance = await api("PATCH", `/pedidos/${pedido.id}/estado`, { token: tokenVendedor, cuerpo: { subpedidoId: sub?.id, estado: "PREPARANDO" } });
r.verificar("8. Vendedor avanza su sub-pedido (PAGADO → PREPARANDO)", avance.status === 200, `status ${avance.status}`);
const notifEstado = await esperar(async () => {
  const n = await api("GET", "/notificaciones", { token });
  return n.datos?.datos?.find((x) => x.pedidoId === pedido.id && x.tipo === "envio");
});
r.verificar("8b. pedido.estado_cambiado → cliente notificado", notifEstado, notifEstado?.titulo);

// ---------- Flujo de pago RECHAZADO (compensación de la saga) ----------
const antesR = await stock(PRODUCTO_RECHAZO);
await api("POST", "/carrito/items", { token, cuerpo: { productoId: PRODUCTO_RECHAZO, cantidad: 1 } });
const pedidoR = (await api("POST", "/pedidos", { token, cuerpo: { direccion }, headers: { "idempotency-key": nuevaClave() } })).datos;
const pagoR = await api("POST", `/pedidos/${pedidoR.id}/pagos`, {
  token, cuerpo: { numeroTarjeta: "4000 0000 0000 0002", titular: "LAURA PETRO", vencimiento: "12/29", cvv: "123" },
});
r.verificar("9. Pago con tarjeta 4000…0002 → rechazado (402)", pagoR.status === 402, `status ${pagoR.status} · ${pagoR.datos?.error?.mensaje}`);
const liberado = await esperar(async () => {
  const s = await stock(PRODUCTO_RECHAZO);
  return s.disponible === antesR.disponible ? s : null;
});
r.verificar("9b. pago.rechazado → inventario libera la reserva (compensación)", liberado,
  `disponible ${antesR.disponible} → ${liberado?.disponible ?? "sin liberar"}`);
const notifR = await esperar(async () => {
  const n = await api("GET", "/notificaciones", { token });
  return n.datos?.datos?.find((x) => x.pedidoId === pedidoR.id && /rechazado/i.test(x.titulo));
});
r.verificar("9c. Cliente notificado del rechazo", notifR, notifR?.titulo);
await api("DELETE", "/carrito", { token });

// ---------- Errores esperados ----------
r.verificar("10. Sin token → 401", (await api("GET", "/carrito")).status === 401);
r.verificar("11. Vendedor intenta comprar → 403", (await api("POST", "/carrito/items", { token: tokenVendedor, cuerpo: { productoId: PRODUCTO, cantidad: 1 } })).status === 403);
r.verificar("12. Producto inexistente → 404", (await api("GET", "/productos/no-existe")).status === 404);
r.verificar("13. Cantidad inválida → 422", (await api("POST", "/carrito/items", { token, cuerpo: { productoId: PRODUCTO, cantidad: 0 } })).status === 422);
const sinStock = await api("POST", "/carrito/items", { token, cuerpo: { productoId: "prd-020", cantidad: 1 } });
r.verificar("14. Producto agotado → 409", sinStock.status === 409, sinStock.datos?.error?.mensaje);
r.verificar("15. Cliente no ve el monitoreo del admin → 403", (await api("GET", "/monitor/eventos", { token })).status === 403);
r.verificar("16. Rutas internas bloqueadas por el gateway → 404", (await api("POST", "/reservas", { token })).status === 404);

process.exit(r.guardar("docs/pruebas/resultados-e2e.md") ? 1 : 0);
