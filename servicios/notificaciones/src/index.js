import mongoose from "mongoose";
import { crearBus, crearLogger, iniciarServidor } from "@plaza/compartido";
import { crearRepositorioNotificaciones } from "./repositorio/notificaciones.repositorio.js";
import { suscribirConsumidor } from "./eventos/consumidor.js";
import { construirApp } from "./app.js";
import { sembrar } from "./seed.js";

const logger = crearLogger("notificaciones");
await mongoose.connect(process.env.MONGO_URL || "mongodb://localhost:27019/notificaciones");
const bus = crearBus({ servicio: "notificaciones", logger });
const repo = crearRepositorioNotificaciones();

const app = construirApp({
  repo,
  bus,
  logger,
  verificaciones: {
    mongo: async () => (await mongoose.connection.db.admin().ping()).ok === 1,
    rabbitmq: () => bus.estaConectado(),
  },
});

if (process.env.SEED_DEMO === "true" && (await repo.contar()) === 0) {
  logger.info({ notificaciones: await sembrar() }, "datos de demostración sembrados");
}

await suscribirConsumidor({ bus, servicio: app.locals.servicio, repo });
iniciarServidor(app, {
  puerto: Number(process.env.PUERTO || 4007),
  logger,
  alCerrar: async () => { await bus.cerrar(); await mongoose.disconnect(); },
});
bus.conectar();
