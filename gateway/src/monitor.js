// Monitoreo básico: salud agregada de los servicios, colas de RabbitMQ y el
// "radar" de eventos que alimenta la Sala de Máquinas y el Modo sustentación.
import { SERVICIOS } from "./rutas.js";

// Quién consume cada evento (documentación viva para el radar).
export const CONSUMIDORES = {
  "usuario.registrado": ["notificaciones"],
  "vendedor.aprobado": ["catalogo", "notificaciones"],
  "vendedor.suspendido": ["catalogo", "notificaciones"],
  "producto.publicado": ["inventario"],
  "pedido.creado": ["notificaciones"],
  "pago.aprobado": ["inventario", "notificaciones", "carrito"],
  "pago.rechazado": ["inventario", "notificaciones"],
  "inventario.actualizado": ["catalogo"],
  "inventario.stock_bajo": ["notificaciones"],
  "pedido.estado_cambiado": ["notificaciones"],
  "reserva.confirmada": ["pedidos-pagos"],
  "reserva.liberada": ["pedidos-pagos"],
  "notificacion.enviada": ["pedidos-pagos"],
};

export function crearMonitor({ bus, logger }) {
  const recientes = []; // últimos 200 sucesos (eventos + pasos HTTP del flujo)
  const clientes = new Set(); // conexiones SSE abiertas

  function emitir(suceso) {
    recientes.push(suceso);
    if (recientes.length > 200) recientes.shift();
    const linea = `data: ${JSON.stringify(suceso)}\n\n`;
    for (const res of clientes) res.write(linea);
  }

  // Todo evento que pase por RabbitMQ llega aquí (cola temporal con binding "#").
  bus.observar((evento) => emitir({
    clase: "evento",
    id: evento.id,
    tipo: evento.tipo,
    origen: evento.origen,
    consumidores: CONSUMIDORES[evento.tipo] || [],
    correlationId: evento.correlationId,
    ocurridoEn: evento.ocurridoEn,
    resumen: evento.datos?.resumen,
  }));

  // Pasos del flujo obligatorio que son REST (no pasan por RabbitMQ).
  const PASOS_HTTP = [
    { paso: "sesion_iniciada", metodo: "POST", patron: /^\/auth\/login$/ },
    { paso: "productos_consultados", metodo: "GET", patron: /^\/productos(\/[^/]+)?$/ },
    { paso: "carrito_agregado", metodo: "POST", patron: /^\/carrito\/items$/ },
    { paso: "pedido_generado", metodo: "POST", patron: /^\/pedidos$/ },
    { paso: "pago_registrado", metodo: "POST", patron: /^\/pedidos\/[^/]+\/pagos$/ },
  ];
  function registrarHttp(req, res) {
    const ruta = req.path;
    const p = PASOS_HTTP.find((x) => x.metodo === req.method && x.patron.test(ruta));
    if (p && res.statusCode < 400) {
      emitir({ clase: "http", tipo: `http.${p.paso}`, origen: "gateway", ruta: `${req.method} ${ruta}`, status: res.statusCode,
        correlationId: req.correlationId, ocurridoEn: new Date().toISOString() });
    }
  }

  function stream(req, res) {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write(`retry: 3000\n\n`);
    clientes.add(res);
    const latido = setInterval(() => res.write(": latido\n\n"), 25000);
    req.on("close", () => { clearInterval(latido); clientes.delete(res); });
  }

  async function saludAgregada() {
    const servicios = await Promise.all(Object.entries(SERVICIOS).map(async ([nombre, { url }]) => {
      const inicio = Date.now();
      try {
        const r = await fetch(`${url}/salud/listo`, { signal: AbortSignal.timeout(1500) });
        const cuerpo = await r.json().catch(() => ({}));
        return { nombre, estado: r.ok ? "ok" : "degradado", latenciaMs: Date.now() - inicio, dependencias: cuerpo.dependencias || {} };
      } catch {
        return { nombre, estado: "caido", latenciaMs: null, dependencias: {} };
      }
    }));
    const rabbitmq = { nombre: "rabbitmq", estado: bus.estaConectado() ? "ok" : "caido" };
    const caidos = servicios.filter((s) => s.estado !== "ok").length;
    return {
      estado: caidos === 0 && rabbitmq.estado === "ok" ? "ok" : "degradado",
      gateway: { estado: "ok", uptimeS: Math.round(process.uptime()) },
      servicios,
      rabbitmq,
      revisadoEn: new Date().toISOString(),
    };
  }

  // Profundidad de las colas (API de administración de RabbitMQ): permite ver
  // en la demo cómo se acumulan mensajes mientras notificaciones está caído.
  async function colas() {
    const url = process.env.RABBITMQ_API || "http://localhost:15672/api";
    const auth = Buffer.from(`${process.env.RABBITMQ_USUARIO || "plaza"}:${process.env.RABBITMQ_CLAVE || "plaza"}`).toString("base64");
    try {
      const r = await fetch(`${url}/queues`, { headers: { authorization: `Basic ${auth}` }, signal: AbortSignal.timeout(2000) });
      const datos = await r.json();
      return datos
        .filter((q) => !q.name.startsWith("amq."))
        .map((q) => ({ nombre: q.name, mensajes: q.messages ?? 0, consumidores: q.consumers ?? 0 }));
    } catch (err) {
      logger.warn({ err: err.message }, "no se pudo consultar la API de RabbitMQ");
      return [];
    }
  }

  return { emitir, registrarHttp, stream, saludAgregada, colas, recientes: () => recientes };
}
