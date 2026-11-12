import jwt from "jsonwebtoken";
import { ErrorNoAutenticado, ErrorProhibido } from "./errores.js";

const secreto = () => process.env.JWT_SECRET || "secreto-solo-para-desarrollo";

export function firmarAcceso(usuario) {
  return jwt.sign(
    { sub: usuario.id, rol: usuario.rol, nombre: usuario.nombre, email: usuario.email },
    secreto(),
    { expiresIn: process.env.JWT_EXPIRA || "15m", issuer: "plaza-sinu" },
  );
}

export function verificarJwt(token) {
  try {
    const p = jwt.verify(token, secreto(), { issuer: "plaza-sinu" });
    return { id: p.sub, rol: p.rol, nombre: p.nombre, email: p.email };
  } catch (e) {
    throw new ErrorNoAutenticado(e.name === "TokenExpiredError" ? "Tu sesión expiró, vuelve a iniciar sesión" : "Token inválido");
  }
}

function extraerToken(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7);
  return req.query?.token;
}

export function autenticar(req, _res, next) {
  const token = extraerToken(req);
  if (!token) return next(new ErrorNoAutenticado());
  req.usuario = verificarJwt(token);
  next();
}

export function autenticarOpcional(req, _res, next) {
  const token = extraerToken(req);
  if (token) {
    try { req.usuario = verificarJwt(token); } catch {}
  }
  next();
}

export function requerirRol(...roles) {
  return (req, _res, next) => {
    if (!req.usuario) return next(new ErrorNoAutenticado());
    if (!roles.includes(req.usuario.rol)) return next(new ErrorProhibido(`Esta acción requiere rol: ${roles.join(" o ")}`));
    next();
  };
}

export function soloInterno(req, _res, next) {
  if (req.headers["x-clave-interna"] !== (process.env.CLAVE_INTERNA || "clave-interna-dev")) {
    return next(new ErrorProhibido("Ruta solo para comunicación interna entre servicios"));
  }
  next();
}
