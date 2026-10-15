// Rutas REST de inventario. /reservas es SOLO interna (la usa pedidos-pagos):
// el gateway no la enruta y además exige la clave interna.
import { Router } from "express";
import { z } from "zod";
import { autenticar, requerirRol, soloInterno, validar } from "@plaza/compartido";

const items = z
  .array(z.object({ productoId: z.string().min(1), cantidad: z.number().int().positive("Debe ser mayor que 0") }))
  .min(1, "Debe incluir al menos un producto");

const esquemaDisponibilidad = z.object({ items });
const esquemaReserva = z.object({
  pedidoId: z.string().min(1),
  items,
  minutos: z.number().int().positive().max(120).optional(),
});
const esquemaAjuste = z.object({
  fisico: z.number().int().min(0, "No puede ser negativo"),
  umbral: z.number().int().min(0).max(1000).optional(),
  nota: z.string().max(200).optional(),
}).strict();
const esquemaLiberar = z.object({ motivo: z.enum(["pago_rechazado", "vencida", "cancelado"]).optional() });

// Disponibilidad en lote: la usan carrito (interno) y el frontend (autenticado).
function internoOAutenticado(req, res, next) {
  if (req.headers["x-clave-interna"]) return soloInterno(req, res, next);
  return autenticar(req, res, next);
}

export function crearRutas(ctrl) {
  const r = Router();
  r.get("/inventario", autenticar, requerirRol("vendedor", "admin"), ctrl.listar);
  r.post("/inventario/disponibilidad", internoOAutenticado, validar(esquemaDisponibilidad), ctrl.disponibilidad);
  r.get("/inventario/:productoId", ctrl.obtener);
  r.put("/inventario/:productoId", autenticar, requerirRol("vendedor", "admin"), validar(esquemaAjuste), ctrl.ajustar);
  r.get("/inventario/:productoId/movimientos", autenticar, requerirRol("vendedor", "admin"), ctrl.movimientos);

  r.post("/reservas", soloInterno, validar(esquemaReserva), ctrl.reservar);
  r.post("/reservas/:id/confirmar", soloInterno, ctrl.confirmar);
  r.post("/reservas/:id/liberar", soloInterno, validar(esquemaLiberar), ctrl.liberar);
  return r;
}
