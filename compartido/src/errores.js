// Clases de error y middleware central. Todos los servicios responden errores
// con el MISMO formato: { error: { codigo, mensaje, detalles, correlationId } }.

export class ErrorApp extends Error {
  constructor(status, codigo, mensaje, detalles = []) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

export class ErrorPeticion extends ErrorApp {
  constructor(mensaje, detalles) { super(400, "PETICION_INVALIDA", mensaje, detalles); }
}
export class ErrorNoAutenticado extends ErrorApp {
  constructor(mensaje = "Debes iniciar sesión para continuar") { super(401, "NO_AUTENTICADO", mensaje); }
}
export class ErrorProhibido extends ErrorApp {
  constructor(mensaje = "No tienes permiso para realizar esta acción") { super(403, "PROHIBIDO", mensaje); }
}
export class ErrorNoEncontrado extends ErrorApp {
  constructor(mensaje = "Recurso no encontrado") { super(404, "NO_ENCONTRADO", mensaje); }
}
export class ErrorConflicto extends ErrorApp {
  constructor(mensaje, codigo = "CONFLICTO", detalles) { super(409, codigo, mensaje, detalles); }
}
export class ErrorValidacion extends ErrorApp {
  constructor(detalles, mensaje = "Los datos enviados no son válidos") { super(422, "VALIDACION", mensaje, detalles); }
}
export class ErrorServicioNoDisponible extends ErrorApp {
  constructor(mensaje = "Servicio no disponible, intenta en unos segundos") { super(503, "SERVICIO_NO_DISPONIBLE", mensaje); }
}

// Ruta inexistente → 404 con el formato común.
export function rutaNoEncontrada(req, _res, next) {
  next(new ErrorNoEncontrado(`No existe la ruta ${req.method} ${req.originalUrl}`));
}

// Middleware de errores: traduce cualquier excepción al formato común.
// Los errores no previstos se registran completos y se responden como 500 genérico.
export function manejadorErrores(logger) {
  // eslint-disable-next-line no-unused-vars
  return (err, req, res, _next) => {
    let error = err;
    if (err?.type === "entity.parse.failed") error = new ErrorPeticion("El cuerpo no es un JSON válido");
    if (!(error instanceof ErrorApp)) {
      logger.error({ err, correlationId: req.correlationId }, "error no controlado");
      error = new ErrorApp(500, "ERROR_INTERNO", "Ocurrió un error inesperado");
    }
    res.status(error.status).json({
      error: {
        codigo: error.codigo,
        mensaje: error.message,
        detalles: error.detalles ?? [],
        correlationId: req.correlationId,
      },
    });
  };
}
