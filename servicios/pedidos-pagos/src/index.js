// Arranque del servicio: Postgres (Prisma), RabbitMQ, consumidores y HTTP.
import prismaPkg from "./generated/prisma/index.js";
import { crearBus, crearLogger, iniciarServidor } from "@plaza/compartido";
import { crearRepositorioPedidos } from "./repositorio/pedidos.repositorio.js";
import { crearClientes } from "./clientes/clientes.js";
import { registrarConsumidores } from "./eventos/consumidores.js";
import { construirApp } from "./app.js";
import { sembrar } from "./seed.js";

const { PrismaClient } = prismaPkg;
const logger = crearLogger("pedidos-pagos");
const prisma = new PrismaClient();
const bus = crearBus({ servicio: "pedidos-pagos", logger });
const repo = crearRepositorioPedidos(prisma);

const app = construirApp({
  repo,
  bus,
  clientes: crearClientes(),
  logger,
  verificaciones: {
    postgres: async () => (await prisma.$queryRaw`SELECT 1`, true),
    rabbitmq: () => bus.estaConectado(),
  },
});

if (process.env.SEED_DEMO === "true" && (await prisma.pedido.count()) === 0) {
  logger.info({ pedidos: await sembrar(prisma) }, "datos de demostración sembrados");
}

iniciarServidor(app, {
  puerto: Number(process.env.PUERTO || 4006),
  logger,
  alCerrar: async () => { await bus.cerrar(); await prisma.$disconnect(); },
});
await registrarConsumidores({ bus, servicio: app.locals.servicio, repo });
bus.conectar(); // reintenta solo; /salud/listo dice 503 mientras no conecte
