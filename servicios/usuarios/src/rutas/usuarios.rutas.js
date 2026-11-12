import { Router } from "express";
import { z } from "zod";
import { autenticar, requerirRol, validar } from "@plaza/compartido";

function edad(fecha) {
  const n = new Date(fecha), hoy = new Date();
  return hoy.getFullYear() - n.getFullYear() - (hoy < new Date(hoy.getFullYear(), n.getMonth(), n.getDate()) ? 1 : 0);
}

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(2, "Mínimo 2 caracteres").max(80),
  email: z.email("Correo no válido"),
  clave: z.string().min(8, "Mínimo 8 caracteres").regex(/\d/, "Debe incluir al menos un número"),
  rol: z.enum(["cliente", "vendedor"]).default("cliente"),
  ciudad: z.string().max(60).optional(),
  telefono: z.string().trim().regex(/^\+?\d{7,15}$/, "Teléfono no válido").optional(),
  tipoDocumento: z.enum(["CC", "CE", "TI", "PP"], "Tipo de documento no válido").optional(),
  numeroDocumento: z.string().trim().regex(/^[0-9A-Za-z]{5,15}$/, "Entre 5 y 15 letras o números").optional(),
  fechaNacimiento: z.iso.date("Fecha no válida").refine((f) => edad(f) >= 18, "Debes ser mayor de edad").optional(),
  direccion: z.string().trim().min(5, "Mínimo 5 caracteres").max(120).optional(),
  aceptaTerminos: z.literal(true, "Debes aceptar los términos").optional(),
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
