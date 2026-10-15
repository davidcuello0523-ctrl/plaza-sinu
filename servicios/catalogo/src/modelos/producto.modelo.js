// Modelo de datos del servicio CATÁLOGO (MongoDB propio: db-catalogo).
// Mongo encaja porque cada categoría tiene atributos distintos (talla, rin,
// voltaje, vueltas…): "atributos" es un subdocumento libre por producto.
// El catálogo NO es dueño del stock: guarda solo una copia del estado
// (estadoStock / stockDisponible) que le avisa inventario por eventos.
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

const productoEsquema = new mongoose.Schema(
  {
    _id: { type: String, default: () => randomUUID() },
    nombre: { type: String, required: true, trim: true },
    slug: { type: String, required: true },
    descripcion: { type: String, default: "" },
    precio: { type: Number, required: true, min: 0 }, // entero en COP
    categoria: { type: String, required: true, index: true },
    atributos: { type: mongoose.Schema.Types.Mixed, default: {} },
    imagenes: { type: [String], default: [] },
    // Copia (snapshot) de datos del vendedor para no consultar otro servicio en cada listado.
    vendedorId: { type: String, required: true, index: true },
    vendedorUsuarioId: { type: String, required: true, index: true },
    nombreTienda: { type: String, required: true },
    colorTienda: { type: String, default: "#E4572E" },
    ciudad: { type: String, default: "" },
    publicado: { type: Boolean, default: false },
    eliminado: { type: Boolean, default: false }, // borrado lógico
    vendedorActivo: { type: Boolean, default: true }, // false si el puesto está suspendido
    estadoStock: { type: String, enum: ["disponible", "ultimas_unidades", "agotado"], default: "agotado" },
    stockDisponible: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: "creadoEn", updatedAt: "actualizadoEn" }, versionKey: false },
);
productoEsquema.index({ publicado: 1, eliminado: 1, vendedorActivo: 1, creadoEn: -1 });

// Ids de eventos ya procesados (consumidores idempotentes).
const eventoProcesadoEsquema = new mongoose.Schema(
  { _id: String, tipo: String, procesadoEn: { type: Date, default: Date.now } },
  { versionKey: false },
);

export const Producto = mongoose.model("Producto", productoEsquema, "productos");
export const EventoProcesado = mongoose.model("EventoProcesado", eventoProcesadoEsquema, "eventos_procesados");
