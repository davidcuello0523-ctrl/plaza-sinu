// Lógica de negocio de los puestos (tiendas): solicitud, aprobación y consulta.
import { randomInt } from "node:crypto";
import { ErrorConflicto, ErrorNoEncontrado } from "@plaza/compartido";

export const crearSlug = (texto) =>
  texto
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/&/g, "y").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Un puesto solo es visible para el público si está aprobado.
export const puedeVer = (vendedor, usuario) =>
  vendedor.estado === "APROBADO" || usuario?.rol === "admin" || usuario?.id === vendedor.usuarioId;

export function crearServicioVendedores({ repo, bus }) {
  async function obtener(id) {
    const v = await repo.buscarPorId(id);
    if (!v) throw new ErrorNoEncontrado("Puesto no encontrado");
    return v;
  }

  return {
    async solicitar(usuario, datos, ctx = {}) {
      if (await repo.buscarPorUsuario(usuario.id)) {
        throw new ErrorConflicto("Ya tienes una solicitud o un puesto registrado", "SOLICITUD_EXISTENTE");
      }
      let slug = crearSlug(datos.nombreTienda);
      if (await repo.buscarPorSlug(slug)) slug = `${slug}-${randomInt(100, 999)}`;
      // NIT simulado: en un sistema real se validaría con la DIAN.
      const nit = datos.nit || `9${randomInt(10000000, 99999999)}-${randomInt(0, 9)}`;
      const v = await repo.crear({ ...datos, nit, slug, usuarioId: usuario.id, estado: "PENDIENTE" });
      return v;
    },

    async listar(filtros, usuario) {
      // El público solo ve aprobados; el admin puede filtrar por cualquier estado.
      const estado = usuario?.rol === "admin" ? filtros.estado : "APROBADO";
      return repo.listar({ ...filtros, estado });
    },

    async verPublico(id, usuario) {
      const v = await obtener(id);
      if (!puedeVer(v, usuario)) throw new ErrorNoEncontrado("Puesto no encontrado");
      return v;
    },

    async mio(usuarioId) {
      const v = await repo.buscarPorUsuario(usuarioId);
      if (!v) throw new ErrorNoEncontrado("Aún no has solicitado abrir tu puesto");
      return v;
    },

    async actualizarMio(usuarioId, cambios) {
      const v = await this.mio(usuarioId);
      return repo.actualizar(v.id, cambios);
    },

    async cambiarEstado(id, { estado, motivo }, ctx = {}) {
      const v = await obtener(id);
      if (v.estado === estado) return v;
      const actualizado = await repo.actualizar(id, {
        estado,
        motivoEstado: motivo ?? null,
        ...(estado === "APROBADO" && { aprobadoEn: new Date() }),
      });
      const datos = { vendedorId: v.id, usuarioId: v.usuarioId, nombreTienda: v.nombreTienda };
      if (estado === "APROBADO") {
        bus.publicar("vendedor.aprobado", { ...datos, resumen: `Puesto aprobado: ${v.nombreTienda}` }, ctx);
      } else if (estado === "SUSPENDIDO") {
        bus.publicar("vendedor.suspendido", { ...datos, resumen: `Puesto suspendido: ${v.nombreTienda}` }, ctx);
      }
      return actualizado;
    },

    // Rutas internas
    porUsuario: async (usuarioId) => {
      const v = await repo.buscarPorUsuario(usuarioId);
      if (!v) throw new ErrorNoEncontrado("El usuario no tiene puesto");
      return v;
    },
    porId: obtener,
  };
}
