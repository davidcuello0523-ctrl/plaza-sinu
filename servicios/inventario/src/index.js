import prismaPkg from "./generated/prisma/index.js";
import { crearBus, crearLogger, iniciarServidor } from "@plaza/compartido";
import { crearRepositorioInventario } from "./repositorio/inventario.repositorio.js";
import { crearServicioInventario } from "./servicios/inventario.servicio.js";
import { registrarConsumidores } from "./eventos/consumidores.js";
import { construirApp } from "./app.js";
import { sembrar } from "./seed.js";

const { PrismaClient } = prismaPkg;
const logger = crearLogger("inventario");
const prisma = new PrismaClient();
const bus = crearBus({ servicio: "inventario", logger });
const repo = crearRepositorioInventario(prisma);
const servicio = crearServicioInventario({ repo, bus, logger });

await prisma.$executeRawUnsafe(`DO $$ BEGIN
  ALTER TABLE "Stock" ADD CONSTRAINT stock_no_negativo CHECK (fisico >= 0 AND reservado >= 0 AND reservado <= fisico);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

if (process.env.SEED_DEMO === "true" && (await prisma.stock.count()) === 0) {
  logger.info({ productos: await sembrar(prisma) }, "datos de demostración sembrados");
}

const app = construirApp({
  servicio,
  logger,
  verificaciones: {
    postgres: async () => (await prisma.$queryRaw`SELECT 1`, true),
    rabbitmq: () => bus.estaConectado(),
  },
});

const job = setInterval(() => servicio.liberarVencidas().catch((err) => logger.error({ err }, "job de vencidas falló")), 30_000);

iniciarServidor(app, {
  puerto: Number(process.env.PUERTO || 4004),
  logger,
  alCerrar: async () => { clearInterval(job); await bus.cerrar(); await prisma.$disconnect(); },
});
registrarConsumidores({ bus, servicio, repo, logger });
bus.conectar();
