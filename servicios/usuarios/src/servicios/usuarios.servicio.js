import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { ErrorConflicto, ErrorNoAutenticado, ErrorNoEncontrado, firmarAcceso } from "@plaza/compartido";

const DIAS_REFRESH = 7;
const sha256 = (texto) => createHash("sha256").update(texto).digest("hex");

export const publico = ({ hashClave, ...usuario }) => usuario;

export function crearServicioUsuarios({ repo, bus }) {
  async function emitirTokens(usuario) {
    const refreshToken = randomBytes(48).toString("hex");
    await repo.guardarRefresh({
      usuarioId: usuario.id,
      tokenHash: sha256(refreshToken),
      expiraEn: new Date(Date.now() + DIAS_REFRESH * 24 * 3600 * 1000),
    });
    return { accessToken: firmarAcceso(usuario), refreshToken, usuario: publico(usuario) };
  }

  return {
    async registrar({ nombre, email, clave, rol, ciudad, telefono, tipoDocumento, numeroDocumento, fechaNacimiento, direccion, aceptaTerminos }, ctx = {}) {
      email = email.toLowerCase();
      if (await repo.buscarPorEmail(email)) throw new ErrorConflicto("Ya existe una cuenta con ese correo", "EMAIL_EN_USO");
      const hashClave = await bcrypt.hash(clave, 10);
      const usuario = await repo.crear({
        nombre, email, hashClave, rol, ciudad, telefono, tipoDocumento, numeroDocumento, direccion,
        fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : undefined,
        aceptoTerminosEn: aceptaTerminos ? new Date() : undefined,
      });
      bus.publicar("usuario.registrado", { usuarioId: usuario.id, nombre, email, rol: usuario.rol }, ctx);
      return emitirTokens(usuario);
    },

    async login({ email, clave }) {
      const usuario = await repo.buscarPorEmail(email.toLowerCase());
      if (!usuario || !usuario.activo || !(await bcrypt.compare(clave, usuario.hashClave))) {
        throw new ErrorNoAutenticado("Correo o contraseña incorrectos");
      }
      return emitirTokens(usuario);
    },

    async refrescar(refreshToken) {
      const registro = await repo.buscarRefresh(sha256(refreshToken));
      if (!registro) throw new ErrorNoAutenticado("Sesión no válida, inicia sesión de nuevo");
      if (registro.revocadoEn) {
        await repo.revocarTodosRefresh(registro.usuarioId);
        throw new ErrorNoAutenticado("Sesión no válida, inicia sesión de nuevo");
      }
      if (registro.expiraEn < new Date()) throw new ErrorNoAutenticado("Tu sesión expiró, inicia sesión de nuevo");
      await repo.revocarRefresh(registro.id);
      const usuario = await repo.buscarPorId(registro.usuarioId);
      return emitirTokens(usuario);
    },

    async logout(refreshToken) {
      const registro = await repo.buscarRefresh(sha256(refreshToken));
      if (registro && !registro.revocadoEn) await repo.revocarRefresh(registro.id);
    },

    async perfil(id) {
      const usuario = await repo.buscarPorId(id);
      if (!usuario) throw new ErrorNoEncontrado("Usuario no encontrado");
      return publico(usuario);
    },

    async actualizarPerfil(id, cambios) {
      await this.perfil(id);
      return publico(await repo.actualizar(id, cambios));
    },

    async listar() {
      return (await repo.listar()).map(publico);
    },
  };
}
