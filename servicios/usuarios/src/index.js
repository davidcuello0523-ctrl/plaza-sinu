import prismaPkg from "./generated/prisma/index.js";
import { crearBus, crearLogger, iniciarServidor } from "@plaza/compartido";
import { crearRepositorioUsuarios } from "./repositorio/usuarios.repositorio.js";
import { construirApp } from "./app.js";
import { sembrar } from "./seed.js";

const { PrismaClient } = prismaPkg;
const logger = crearLogger("usuarios");
const prisma = new PrismaClient();
const bus = crearBus({ servicio: "usuarios", logger });

const app = construirApp({
  repo: crearRepositorioUsuarios(prisma),
  bus,
  logger,
  verificaciones: {
    postgres: async () => (await prisma.$queryRaw`SELECT 1`, true),
    rabbitmq: () => bus.estaConectado(),
  },
});

if (process.env.SEED_DEMO === "true" && (await prisma.usuario.count()) === 0) {
  logger.info({ usuarios: await sembrar(prisma) }, "datos de demostración sembrados");
}

iniciarServidor(app, {
  puerto: Number(process.env.PUERTO || 4001),
  logger,
  alCerrar: async () => { await bus.cerrar(); await prisma.$disconnect(); },
});
bus.conectar();
