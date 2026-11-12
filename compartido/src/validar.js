import { ErrorValidacion } from "./errores.js";

export function validar(esquema, origen = "body") {
  return (req, _res, next) => {
    const resultado = esquema.safeParse(req[origen] ?? {});
    if (!resultado.success) {
      const detalles = resultado.error.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message }));
      return next(new ErrorValidacion(detalles));
    }
    if (origen === "body") req.body = resultado.data;
    else req.validado = { ...(req.validado || {}), [origen]: resultado.data };
    next();
  };
}
