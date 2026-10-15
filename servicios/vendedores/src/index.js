// Arranque del servicio: conecta Postgres (Prisma) y RabbitMQ y levanta HTTP.
import prismaPkg from "./generated/prisma/index.js";
import { crearBus, crearLogger, iniciarServidor } from "@plaza/compartido";
import { crearRepositorioVendedores } from "./repositorio/vendedores.repositorio.js";
import { construirApp } from "./app.js";
import { sembrar } from "./seed.js";

const { PrismaClient } = prismaPkg;
const logger = crearLogger("vendedores");
const prisma = new PrismaClient();
const bus = crearBus({ servicio: "vendedores", logger });

const app = construirApp({
  repo: crearRepositorioVendedores(prisma),
  bus,
  logger,
  verificaciones: {
    postgres: async () => (await prisma.$queryRaw`SELECT 1`, true),
    rabbitmq: () => bus.estaConectado(),
  },
});

if (process.env.SEED_DEMO === "true" && (await prisma.vendedor.count()) === 0) {
  logger.info({ vendedores: await sembrar(prisma) }, "datos de demostración sembrados");
}

iniciarServidor(app, {
  puerto: Number(process.env.PUERTO || 4002),
  logger,
  alCerrar: async () => { await bus.cerrar(); await prisma.$disconnect(); },
});
bus.conectar();
