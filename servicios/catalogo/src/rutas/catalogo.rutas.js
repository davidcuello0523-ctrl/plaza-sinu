import { Router } from "express";
import { z } from "zod";
import { autenticar, autenticarOpcional, requerirRol, soloInterno, validar } from "@plaza/compartido";
import { SLUGS_CATEGORIA } from "../categorias.js";

const booleanoQuery = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");
const pesos = z.coerce.number().int("Debe ser un número entero").min(0);

const esquemaFiltros = z.object({
  q: z.string().max(80).optional(),
  categoria: z.enum(SLUGS_CATEGORIA, "Categoría no válida").optional(),
  vendedor: z.string().optional(),
  precioMin: pesos.optional(),
  precioMax: pesos.optional(),
  soloDisponibles: booleanoQuery.optional(),
  estadoStock: z.enum(["disponible", "ultimas_unidades", "agotado"]).optional(),
  mios: booleanoQuery.optional(),
  orden: z.enum(["recientes", "precio_asc", "precio_desc", "nombre"]).default("recientes"),
  pagina: z.coerce.number().int().min(1).default(1),
  porPagina: z.coerce.number().int().min(1).max(60).default(12),
});

const valorAtributo = z.union([z.string().max(120), z.number(), z.boolean()]);
const esquemaProducto = z.object({
  nombre: z.string().trim().min(3, "Mínimo 3 caracteres").max(120),
  descripcion: z.string().trim().max(2000).default(""),
  precio: z.number("El precio debe ser numérico").int("Pesos enteros, sin decimales").positive("Debe ser mayor que 0").max(100_000_000),
  categoria: z.enum(SLUGS_CATEGORIA, "Categoría no válida"),
  atributos: z.record(z.string().max(40), valorAtributo).default({}),
  imagenes: z.array(z.string().max(300)).max(6).optional(),
  publicado: z.boolean().default(true),
});
const esquemaPublicacion = z.object({ publicado: z.boolean("Indica true o false") });
const esquemaIds = z.object({
  ids: z.string().min(1, "Indica ids separados por coma").transform((s) => s.split(",").map((x) => x.trim()).filter(Boolean)),
});

export function crearRutas(ctrl) {
  const r = Router();
  r.get("/interno/productos", soloInterno, validar(esquemaIds, "query"), ctrl.internoPorIds);

  r.get("/categorias", ctrl.categorias);
  r.get("/productos", autenticarOpcional, validar(esquemaFiltros, "query"), ctrl.listar);
  r.get("/productos/:id/imagen.svg", ctrl.imagen);
  r.get("/productos/:id/foto.jpg", ctrl.foto);
  r.get("/productos/:id", autenticarOpcional, ctrl.ver);
  r.post("/productos", autenticar, requerirRol("vendedor"), validar(esquemaProducto), ctrl.crear);
  r.put("/productos/:id", autenticar, requerirRol("vendedor"), validar(esquemaProducto.omit({ publicado: true })), ctrl.actualizar);
  r.patch("/productos/:id/publicacion", autenticar, requerirRol("vendedor"), validar(esquemaPublicacion), ctrl.publicacion);
  r.delete("/productos/:id", autenticar, requerirRol("vendedor", "admin"), ctrl.eliminar);
  return r;
}
