// Mensajería asíncrona con RabbitMQ.
// Exchange topic "plaza.eventos": cada servicio publica con la clave = tipo
// del evento (p. ej. "pago.aprobado") y cada consumidor tiene SU cola durable,
// así que si un consumidor está caído los mensajes esperan en su cola.
import amqp from "amqplib";
import { randomUUID } from "node:crypto";

export const EXCHANGE = "plaza.eventos";
const EXCHANGE_DLX = "plaza.dlx";
const MAX_INTENTOS = 3;

// Formato común de todos los eventos.
export function crearEvento(tipo, datos, { origen, correlationId } = {}) {
  return {
    id: randomUUID(),
    tipo,
    version: 1,
    ocurridoEn: new Date().toISOString(),
    correlationId: correlationId || randomUUID(),
    origen,
    datos,
  };
}

export function crearBus({ servicio, url = process.env.RABBITMQ_URL, logger }) {
  let conexion = null;
  let canal = null;
  let conectado = false;
  const consumidores = []; // se re-registran al reconectar
  const observadores = [];
  // shortcut: pendientes en memoria si el broker cae; se pierden si el proceso muere → usar patrón outbox en producción
  const pendientes = [];

  async function conectar() {
    for (let intento = 1; ; intento++) {
      try {
        conexion = await amqp.connect(url);
        canal = await conexion.createChannel();
        await canal.assertExchange(EXCHANGE, "topic", { durable: true });
        await canal.assertExchange(EXCHANGE_DLX, "direct", { durable: true });
        await canal.prefetch(10);
        conectado = true;
        conexion.on("error", () => {});
        conexion.on("close", () => {
          conectado = false;
          logger.warn("conexión con RabbitMQ perdida, reintentando…");
          setTimeout(() => conectar().catch(() => {}), 2000);
        });
        for (const c of consumidores) await registrar(c);
        for (const o of observadores) await registrarObservador(o);
        while (pendientes.length) {
          const evento = pendientes.shift();
          enviar(evento);
        }
        logger.info("conectado a RabbitMQ");
        return;
      } catch (err) {
        logger.warn({ intento, err: err.message }, "RabbitMQ no disponible, reintentando en 3 s");
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
  }

  function enviar(evento) {
    canal.publish(EXCHANGE, evento.tipo, Buffer.from(JSON.stringify(evento)), {
      persistent: true,
      contentType: "application/json",
      messageId: evento.id,
      headers: { "x-correlation-id": evento.correlationId },
    });
  }

  // Publica un evento. Devuelve el evento creado (útil para registrar la traza).
  function publicar(tipo, datos, { correlationId } = {}) {
    const evento = crearEvento(tipo, datos, { origen: servicio, correlationId });
    if (conectado) enviar(evento);
    else pendientes.push(evento);
    logger.info({ correlationId: evento.correlationId, evento: tipo, eventoId: evento.id }, "evento publicado");
    return evento;
  }

  async function registrar({ cola, claves, manejador, procesados }) {
    await canal.assertQueue(`${cola}.dlq`, { durable: true });
    await canal.bindQueue(`${cola}.dlq`, EXCHANGE_DLX, cola);
    await canal.assertQueue(cola, {
      durable: true,
      arguments: { "x-dead-letter-exchange": EXCHANGE_DLX, "x-dead-letter-routing-key": cola },
    });
    for (const clave of claves) await canal.bindQueue(cola, EXCHANGE, clave);

    await canal.consume(cola, async (msg) => {
      if (!msg) return;
      let evento;
      try {
        evento = JSON.parse(msg.content.toString());
      } catch {
        canal.nack(msg, false, false); // mensaje corrupto → DLQ directo
        return;
      }
      const log = logger.child({ correlationId: evento.correlationId, evento: evento.tipo, eventoId: evento.id });
      try {
        // Idempotencia: RabbitMQ garantiza "al menos una vez", así que un
        // mismo evento puede llegar dos veces; si ya lo procesamos, se ignora.
        if (procesados && (await procesados.existe(evento.id))) {
          log.info("evento duplicado ignorado");
        } else {
          await manejador(evento);
          if (procesados) await procesados.guardar(evento.id, evento.tipo);
          log.info("evento procesado");
        }
        canal.ack(msg);
      } catch (err) {
        const intentos = (msg.properties.headers?.["x-intentos"] || 0) + 1;
        if (intentos < MAX_INTENTOS) {
          log.warn({ intentos, err: err.message }, "falló el procesamiento, se reintenta");
          canal.sendToQueue(cola, msg.content, { ...msg.properties, headers: { ...msg.properties.headers, "x-intentos": intentos } });
          canal.ack(msg);
        } else {
          log.error({ err: err.message }, `evento enviado a ${cola}.dlq tras ${MAX_INTENTOS} intentos`);
          canal.nack(msg, false, false);
        }
      }
    });
  }

  // Suscribe un consumidor durable. Si aún no hay conexión, se registra al conectar.
  async function consumir(opciones) {
    consumidores.push(opciones);
    if (conectado) await registrar(opciones);
  }

  // Cola temporal que ve TODOS los eventos (la usa el gateway para el radar).
  async function registrarObservador(manejador) {
    const { queue } = await canal.assertQueue("", { exclusive: true, autoDelete: true });
    await canal.bindQueue(queue, EXCHANGE, "#");
    await canal.consume(queue, (msg) => {
      try { manejador(JSON.parse(msg.content.toString())); } catch { /* mensaje ilegible: se ignora */ }
    }, { noAck: true });
  }

  async function observar(manejador) {
    observadores.push(manejador);
    if (conectado) await registrarObservador(manejador);
  }

  return {
    conectar,
    publicar,
    consumir,
    observar,
    estaConectado: () => conectado,
    cerrar: async () => { conectado = false; conexion?.removeAllListeners("close"); await conexion?.close().catch(() => {}); },
  };
}
