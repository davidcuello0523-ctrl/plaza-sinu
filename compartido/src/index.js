// Punto de entrada de @plaza/compartido.
// Solo utilidades TÉCNICAS. Aquí no hay modelos de dominio (Producto, Pedido…):
// si los compartiéramos, cambiar un servicio obligaría a desplegar los demás
// y volveríamos a un monolito distribuido.
export * from "./errores.js";
export * from "./auth.js";
export * from "./validar.js";
export * from "./clienteHttp.js";
export * from "./eventos.js";
export * from "./app.js";
export { crearLogger } from "./logger.js";
