import { Router } from "express";
import { z } from "zod";
import { autenticar, autenticarOpcional, requerirRol, soloInterno, validar } from "@plaza/compartido";

export const CATEGORIAS = ["tecnologia", "bicicletas", "ropa", "hogar", "artesanias", "papeleria", "deportes"];
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Color hexadecimal, p. ej. #E4572E");

const esquemaSolicitud = z.object({
  nombreTienda: z.string().trim().min(3, "Mínimo 3 caracteres").max(60),
  descripcion: z.string().trim().max(500).default(""),
  categoriaPrincipal: z.enum(CATEGORIAS, "Categoría no válida"),
  ciudad: z.string().trim().min(2).max(60),
  color: color.default("#E4572E"),
  nit: z.string().regex(/^\d{9}-\d$/, "Formato de NIT: 900123456-7").optional(),
  telefono: z.string().max(20).optional(),
});
const esquemaEdicion = z
  .object({ descripcion: z.string().trim().max(500), color, telefono: z.string().max(20) })
  .partial()
  .strict();
const esquemaEstado = z.object({
  estado: z.enum(["APROBADO", "SUSPENDIDO", "RECHAZADO"], "Estado no válido"),
  motivo: z.string().max(300).optional(),
});
const esquemaFiltros = z.object({
  estado: z.enum(["PENDIENTE", "APROBADO", "SUSPENDIDO", "RECHAZADO"]).optional(),
  ciudad: z.string().optional(),
  categoria: z.string().optional(),
});

export function crearRutas(ctrl) {
  const r = Router();
  r.get("/interno/vendedores/por-usuario/:usuarioId", soloInterno, ctrl.internoPorUsuario);
  r.get("/interno/vendedores/:id", soloInterno, ctrl.internoPorId);

  r.post("/vendedores/solicitudes", autenticar, requerirRol("vendedor"), validar(esquemaSolicitud), ctrl.solicitar);
  r.get("/vendedores", autenticarOpcional, validar(esquemaFiltros, "query"), ctrl.listar);
  r.get("/vendedores/yo", autenticar, requerirRol("vendedor"), ctrl.yo);
  r.patch("/vendedores/yo", autenticar, requerirRol("vendedor"), validar(esquemaEdicion), ctrl.actualizarYo);
  r.get("/vendedores/:id", autenticarOpcional, ctrl.ver);
  r.patch("/vendedores/:id/estado", autenticar, requerirRol("admin"), validar(esquemaEstado), ctrl.cambiarEstado);
  return r;
}
