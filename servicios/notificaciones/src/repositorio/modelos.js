// Modelo de datos del servicio NOTIFICACIONES (MongoDB propio: db-notificaciones).
// Documentos sin relaciones: cada notificación se lee sola, por usuario.
import mongoose from "mongoose";

const notificacionEsquema = new mongoose.Schema({
  usuarioId: { type: String, required: true, index: true },
  rol: String,
  tipo: { type: String, enum: ["bienvenida", "pedido", "pago", "stock", "envio", "puesto"], required: true },
  titulo: { type: String, required: true },
  mensaje: String,
  enlace: String,
  leida: { type: Boolean, default: false },
  pedidoId: String,
  codigoPedido: String,
  eventoId: String,
  eventoTipo: String,
  correlationId: String,
  creadoEn: { type: Date, default: Date.now },
}, { versionKey: false });
notificacionEsquema.index({ usuarioId: 1, creadoEn: -1 });

// Correo SIMULADO: se guarda en lugar de enviarse (no hay servidor SMTP).
const correoEsquema = new mongoose.Schema({
  para: String,
  asunto: String,
  cuerpo: String,
  eventoTipo: String,
  enviadoEn: { type: Date, default: Date.now },
}, { versionKey: false });

// Ids de eventos ya procesados (idempotencia del consumidor).
const eventoProcesadoEsquema = new mongoose.Schema({
  _id: String,
  tipo: String,
  procesadoEn: { type: Date, default: Date.now },
}, { versionKey: false });

export const Notificacion = mongoose.model("Notificacion", notificacionEsquema, "notificaciones");
export const Correo = mongoose.model("Correo", correoEsquema, "correos");
export const EventoProcesado = mongoose.model("EventoProcesado", eventoProcesadoEsquema, "eventosProcesados");
