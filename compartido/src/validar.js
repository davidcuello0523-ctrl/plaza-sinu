// Valida body/query/params con zod. Si falla → 422 con el detalle por campo.
import { ErrorValidacion } from "./errores.js";

export function validar(esquema, origen = "body") {
  return (req, _res, next) => {
    const resultado = esquema.safeParse(req[origen] ?? {});
    if (!resultado.success) {
      const detalles = resultado.error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message }));
      return next(new ErrorValidacion(detalles));
    }
    // En Express 5 req.query es de solo lectura: guardamos lo validado aparte.
    if (origen === "body") req.body = resultado.data;
    else req.validado = { ...(req.validado || {}), [origen]: resultado.data };
    next();
  };
}
