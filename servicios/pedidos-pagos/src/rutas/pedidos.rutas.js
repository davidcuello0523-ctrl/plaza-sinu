import { Router } from "express";
import { z } from "zod";
import { autenticar, requerirRol, validar } from "@plaza/compartido";

const ESTADOS_PEDIDO = ["PENDIENTE_PAGO", "PAGADO", "PAGO_RECHAZADO", "RECHAZADO_SIN_STOCK", "CANCELADO", "COMPLETADO"];

const esquemaPedido = z.object({
  direccion: z.object({
    nombreRecibe: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
    telefono: z.string().trim().regex(/^[\d\s+()-]{7,20}$/, "Teléfono no válido"),
    ciudad: z.string().trim().min(2, "Requerida").max(60),
    direccion: z.string().trim().min(5, "Escribe la dirección completa").max(120),
    indicaciones: z.string().trim().max(200).optional(),
  }),
});

const esquemaPago = z.object({
  numeroTarjeta: z.string().regex(/^[\d\s-]{13,23}$/, "Número de tarjeta inválido"),
  titular: z.string().trim().min(3, "Escribe el nombre como aparece en la tarjeta").max(80),
  vencimiento: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Formato MM/AA"),
  cvv: z.string().regex(/^\d{3,4}$/, "CVV de 3 o 4 dígitos"),
});

const esquemaEstado = z.object({
  subpedidoId: z.string().min(1, "Requerido"),
  estado: z.enum(["PREPARANDO", "ENVIADO", "ENTREGADO"]),
});

const esquemaListado = z.object({
  estado: z.enum(ESTADOS_PEDIDO).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(50).default(10),
});

export function crearRutas(ctrl) {
  const r = Router();
  r.use(["/pedidos", "/metricas"], autenticar);
  r.get("/metricas", requerirRol("admin"), ctrl.metricas);
  r.get("/metricas/vendedor", requerirRol("vendedor"), ctrl.metricasVendedor);
  r.post("/pedidos", requerirRol("cliente"), validar(esquemaPedido), ctrl.crear);
  r.get("/pedidos", validar(esquemaListado, "query"), ctrl.listar);
  r.get("/pedidos/:id", ctrl.detalle);
  r.get("/pedidos/:id/traza", ctrl.traza);
  r.post("/pedidos/:id/pagos", requerirRol("cliente"), validar(esquemaPago), ctrl.pagar);
  r.patch("/pedidos/:id/estado", requerirRol("vendedor", "admin"), validar(esquemaEstado), ctrl.cambiarEstado);
  r.post("/pedidos/:id/cancelar", requerirRol("cliente", "admin"), ctrl.cancelar);
  return r;
}
