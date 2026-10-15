// Rutas REST de notificaciones. Todas exigen JWT (el stream lo recibe por ?token=).
import { Router } from "express";
import { z } from "zod";
import { autenticar, validar } from "@plaza/compartido";

const esquemaLista = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(50).default(20),
  noLeidas: z.enum(["0", "1", "true", "false"]).optional().transform((v) => v === "1" || v === "true"),
});

export function crearRutas(ctrl) {
  const r = Router();
  r.get("/notificaciones/stream", autenticar, ctrl.stream);
  r.get("/notificaciones", autenticar, validar(esquemaLista, "query"), ctrl.listar);
  r.patch("/notificaciones/leer-todas", autenticar, ctrl.leerTodas);
  r.patch("/notificaciones/:id/leida", autenticar, ctrl.marcarLeida);
  return r;
}
