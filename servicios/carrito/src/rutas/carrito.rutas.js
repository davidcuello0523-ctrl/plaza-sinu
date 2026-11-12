import { Router } from "express";
import { z } from "zod";
import { ErrorProhibido, autenticar, soloInterno, validar } from "@plaza/compartido";

const cantidad = z.number("Debe ser un número").int("Debe ser un entero").min(1, "Mínimo 1").max(20, "Máximo 20 por producto");
const esquemaAgregar = z.object({ productoId: z.string().trim().min(1, "Requerido"), cantidad });
const esquemaCantidad = z.object({ cantidad });

function soloClientes(req, _res, next) {
  if (req.usuario.rol !== "cliente") return next(new ErrorProhibido("Solo los clientes pueden comprar"));
  next();
}

export function crearRutas(ctrl) {
  const r = Router();
  r.get("/interno/carrito/:usuarioId", soloInterno, ctrl.verInterno);
  r.delete("/interno/carrito/:usuarioId", soloInterno, ctrl.vaciarInterno);

  r.use("/carrito", autenticar, soloClientes);
  r.get("/carrito", ctrl.ver);
  r.post("/carrito/items", validar(esquemaAgregar), ctrl.agregar);
  r.patch("/carrito/items/:productoId", validar(esquemaCantidad), ctrl.cambiarCantidad);
  r.delete("/carrito/items/:productoId", ctrl.quitar);
  r.delete("/carrito", ctrl.vaciar);
  return r;
}
