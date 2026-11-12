import mongoose from "mongoose";
import { Notificacion } from "./repositorio/modelos.js";

const id = (n) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const hace = (horas) => new Date(Date.now() - horas * 3600 * 1000);

const DEMO = [
  { usuarioId: id(11), rol: "cliente", tipo: "bienvenida", titulo: "¡Bienvenida a Plaza Sinú, Laura!", mensaje: "Ya puedes recorrer los puestos de Córdoba y comprar a varias tiendas en un solo carrito.", enlace: "/catalogo", leida: true, creadoEn: hace(240) },
  { usuarioId: id(11), rol: "cliente", tipo: "envio", titulo: "Tu pedido PS-000101 de Rueda Libre está entregado", mensaje: "¡Gracias por comprar en Plaza Sinú!", enlace: "/pedidos", leida: true, creadoEn: hace(72) },
  { usuarioId: id(101), rol: "vendedor", tipo: "puesto", titulo: "Tu puesto Tecno Sinú fue aprobado", mensaje: "Ya puedes publicar productos y recibir pedidos.", enlace: "/mi-puesto", leida: true, creadoEn: hace(300) },
  { usuarioId: id(102), rol: "vendedor", tipo: "stock", titulo: "Stock bajo: Casco MTB ventilado (quedan 2)", mensaje: "Llegó al umbral de 3 unidades. Ajusta tu inventario para no quedarte sin ventas.", enlace: "/mi-puesto/inventario", leida: false, creadoEn: hace(5) },
];

export async function sembrar() {
  await Notificacion.insertMany(DEMO);
  return DEMO.length;
}

if (process.argv[1]?.endsWith("seed.js")) {
  await mongoose.connect(process.env.MONGO_URL || "mongodb://localhost:27019/notificaciones");
  console.log(`notificaciones: ${await sembrar()} notificaciones de demostración`);
  await mongoose.disconnect();
}
