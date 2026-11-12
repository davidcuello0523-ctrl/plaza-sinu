import mongoose from "mongoose";
import { crearBus, crearClienteHttp, crearLogger, iniciarServidor } from "@plaza/compartido";
import { crearRepositorioProductos } from "./repositorio/productos.repositorio.js";
import { registrarConsumidores } from "./eventos/consumidores.js";
import { Producto } from "./modelos/producto.modelo.js";
import { construirApp } from "./app.js";
import { sembrar } from "./seed.js";

const logger = crearLogger("catalogo");
await mongoose.connect(process.env.MONGO_URL || "mongodb://localhost:27018/catalogo");
const bus = crearBus({ servicio: "catalogo", logger });
const repo = crearRepositorioProductos();

const app = construirApp({
  repo,
  bus,
  clientes: { vendedores: crearClienteHttp({ servicio: "vendedores", urlBase: process.env.VENDEDORES_URL || "http://localhost:4002" }) },
  logger,
  verificaciones: {
    mongo: async () => (await mongoose.connection.db.admin().ping()).ok === 1,
    rabbitmq: () => bus.estaConectado(),
  },
});

if (process.env.SEED_DEMO === "true" && (await Producto.estimatedDocumentCount()) === 0) {
  logger.info({ productos: await sembrar() }, "datos de demostración sembrados");
}

registrarConsumidores(bus, repo);
iniciarServidor(app, {
  puerto: Number(process.env.PUERTO || 4003),
  logger,
  alCerrar: async () => { await bus.cerrar(); await mongoose.disconnect(); },
});
bus.conectar();
