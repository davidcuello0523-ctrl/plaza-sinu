// Reglas de dominio PURAS (sin BD ni HTTP): totales, máquina de estados y
// pasarela de pago simulada. Son lo primero que se prueba con Jest.
import { randomBytes } from "node:crypto";
import { ErrorConflicto, ErrorValidacion } from "@plaza/compartido";

export const formatoCOP = (n) => `$ ${Math.round(n).toLocaleString("es-CO")}`;
export const codigoPedido = (n) => `PS-${String(n).padStart(6, "0")}`;

// lineas: [{ productoId, nombre, categoria, imagen, precioUnitario, cantidad,
//            vendedorId, vendedorUsuarioId, nombreTienda }]
// → un sub-pedido por vendedor con su subtotal, más total y unidades globales.
export function calcularTotales(lineas) {
  const porVendedor = new Map();
  for (const l of lineas) {
    if (!porVendedor.has(l.vendedorId)) {
      porVendedor.set(l.vendedorId, {
        vendedorId: l.vendedorId,
        vendedorUsuarioId: l.vendedorUsuarioId,
        nombreTienda: l.nombreTienda,
        subtotal: 0,
        unidades: 0,
        items: [],
      });
    }
    const sub = porVendedor.get(l.vendedorId);
    const subtotal = l.precioUnitario * l.cantidad;
    sub.items.push({
      productoId: l.productoId, nombre: l.nombre, categoria: l.categoria ?? null, imagen: l.imagen ?? null,
      precioUnitario: l.precioUnitario, cantidad: l.cantidad, subtotal,
    });
    sub.subtotal += subtotal;
    sub.unidades += l.cantidad;
  }
  const subpedidos = [...porVendedor.values()];
  return {
    subpedidos,
    total: subpedidos.reduce((s, x) => s + x.subtotal, 0),
    unidades: subpedidos.reduce((s, x) => s + x.unidades, 0),
  };
}

// ---------- Máquina de estados ----------
export const TRANSICIONES_PEDIDO = {
  PENDIENTE_PAGO: ["PAGADO", "PAGO_RECHAZADO", "CANCELADO"],
  PAGADO: ["COMPLETADO"],
  PAGO_RECHAZADO: [],
  RECHAZADO_SIN_STOCK: [],
  CANCELADO: [],
  COMPLETADO: [],
};

export const TRANSICIONES_SUBPEDIDO = {
  PENDIENTE_PAGO: ["PAGADO", "CANCELADO"],
  PAGADO: ["PREPARANDO"],
  PREPARANDO: ["ENVIADO"],
  ENVIADO: ["ENTREGADO"],
  ENTREGADO: [],
  CANCELADO: [],
};

function validarTransicion(tabla, desde, hacia) {
  if (!(tabla[desde] || []).includes(hacia)) {
    throw new ErrorConflicto(`No se puede pasar de ${desde} a ${hacia}`, "TRANSICION_INVALIDA");
  }
}
export const validarTransicionPedido = (desde, hacia) => validarTransicion(TRANSICIONES_PEDIDO, desde, hacia);
export const validarTransicionSubpedido = (desde, hacia) => validarTransicion(TRANSICIONES_SUBPEDIDO, desde, hacia);

// Estados de sub-pedido que cuentan como venta (ya se pagaron).
export const ESTADOS_VENDIDOS = ["PAGADO", "PREPARANDO", "ENVIADO", "ENTREGADO"];

// ---------- Pasarela de pago SIMULADA ----------
export const TARJETA_APRUEBA = "4242424242424242";
export const TARJETA_RECHAZA = "4000000000000002";

// Algoritmo de Luhn: el dígito verificador que usan todas las tarjetas reales.
export function luhnValido(numero) {
  let suma = 0;
  let doble = false;
  for (let i = numero.length - 1; i >= 0; i--) {
    let d = Number(numero[i]);
    if (doble) { d *= 2; if (d > 9) d -= 9; }
    suma += d;
    doble = !doble;
  }
  return numero.length >= 13 && suma % 10 === 0;
}

export function marcaDe(numero) {
  if (numero.startsWith("4")) return "Visa";
  if (/^5[1-5]/.test(numero)) return "Mastercard";
  return "Otra";
}

// Vencimiento MM/AA: la tarjeta vale hasta el último día de ese mes.
export function tarjetaVencida(vencimiento, hoy = new Date()) {
  const [mm, aa] = vencimiento.split("/").map(Number);
  return new Date(2000 + aa, mm, 1) <= hoy; // día 1 del mes SIGUIENTE
}

// Devuelve SOLO marca y últimos 4: el número completo y el CVV nunca se guardan.
export function procesarPago({ numeroTarjeta, vencimiento }) {
  const numero = numeroTarjeta.replace(/[\s-]/g, "");
  if (!/^\d{13,19}$/.test(numero) || !luhnValido(numero)) {
    throw new ErrorValidacion([{ campo: "numeroTarjeta", mensaje: "Número de tarjeta inválido" }]);
  }
  if (vencimiento && tarjetaVencida(vencimiento)) {
    throw new ErrorValidacion([{ campo: "vencimiento", mensaje: "La tarjeta está vencida" }]);
  }
  const base = { marca: marcaDe(numero), ultimos4: numero.slice(-4), referencia: `SIM-${randomBytes(4).toString("hex").toUpperCase()}` };
  if (numero === TARJETA_APRUEBA) return { ...base, estado: "APROBADO" };
  if (numero === TARJETA_RECHAZA) return { ...base, estado: "RECHAZADO", motivo: "Fondos insuficientes" };
  throw new ErrorValidacion(
    [{ campo: "numeroTarjeta", mensaje: "Tarjeta no reconocida por la pasarela de pruebas" }],
    "Usa una tarjeta de prueba: 4242 4242 4242 4242 (aprueba) o 4000 0000 0000 0002 (rechaza)",
  );
}
