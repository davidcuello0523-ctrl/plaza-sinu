import { Router } from "express";
import { z } from "zod";
import { autenticar, requerirRol, validar } from "@plaza/compartido";

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  email: z.email("Correo no válido"),
  clave: z.string().min(8, "Mínimo 8 caracteres").regex(/\d/, "Debe incluir al menos un número"),
  rol: z.enum(["cliente", "vendedor"]).default("cliente"),
  ciudad: z.string().max(60).optional(),
  telefono: z.string().max(20).optional(),
});
const esquemaLogin = z.object({ email: z.email("Correo no válido"), clave: z.string().min(1, "Requerida") });
const esquemaRefresh = z.object({ refreshToken: z.string().min(10, "Refresh token requerido") });
const esquemaPerfil = z
  .object({ nombre: z.string().trim().min(2).max(80), ciudad: z.string().max(60), telefono: z.string().max(20) })
  .partial()
  .strict();

export function crearRutas(ctrl) {
  const r = Router();
  r.post("/auth/registro", validar(esquemaRegistro), ctrl.registro);
  r.post("/auth/login", validar(esquemaLogin), ctrl.login);
  r.post("/auth/refresh", validar(esquemaRefresh), ctrl.refresh);
  r.post("/auth/logout", validar(esquemaRefresh), ctrl.logout);
  r.get("/usuarios/yo", autenticar, ctrl.yo);
  r.patch("/usuarios/yo", autenticar, validar(esquemaPerfil), ctrl.actualizarYo);
  r.get("/usuarios", autenticar, requerirRol("admin"), ctrl.listar);
  return r;
}
