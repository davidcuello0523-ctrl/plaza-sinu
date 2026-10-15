// Arranque del servicio: conecta Redis y RabbitMQ y levanta HTTP.
import Redis from "ioredis";
import { crearBus, crearLogger, iniciarServidor } from "@plaza/compartido";
import { crearRepositorioCarrito } from "./repositorio/carrito.repositorio.js";
import { crearClientes } from "./clientes/clientes.js";
import { registrarConsumidores } from "./eventos/consumidores.js";
import { construirApp } from "./app.js";

const logger = crearLogger("carrito");
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6380");
redis.on("error", (err) => logger.warn({ err: err.message }, "error de Redis"));
const bus = crearBus({ servicio: "carrito", logger });
const repo = crearRepositorioCarrito(redis);

const app = construirApp({
  repo,
  clientes: crearClientes(),
  logger,
  verificaciones: {
    redis: async () => (await redis.ping()) === "PONG",
    rabbitmq: () => bus.estaConectado(),
  },
});

registrarConsumidores({ bus, repo });
iniciarServidor(app, {
  puerto: Number(process.env.PUERTO || 4005),
  logger,
  alCerrar: async () => { await bus.cerrar(); redis.disconnect(); },
});
bus.conectar();
