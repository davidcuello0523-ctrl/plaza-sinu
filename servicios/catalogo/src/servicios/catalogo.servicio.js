// Lógica del catálogo: listar, ver, publicar y editar productos.
// Autorización POR RECURSO: un vendedor solo toca SUS productos.
import { randomUUID } from "node:crypto";
import { ErrorApp, ErrorNoEncontrado, ErrorProhibido } from "@plaza/compartido";
import { CATEGORIAS } from "../categorias.js";

const crearSlug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const esDueno = (p, usuario) => usuario?.id === p.vendedorUsuarioId;
const esVisible = (p) => p.publicado && !p.eliminado && p.vendedorActivo;

export function crearServicioCatalogo({ repo, bus, clientes }) {
  async function obtenerPropio(id, usuario) {
    const p = await repo.buscarPorId(id);
    if (!p || p.eliminado) throw new ErrorNoEncontrado("Producto no encontrado");
    if (!esDueno(p, usuario)) throw new ErrorProhibido("Solo el vendedor dueño puede modificar este producto");
    return p;
  }

  function avisarPublicado(p, ctx) {
    bus.publicar("producto.publicado", {
      productoId: p.id, vendedorId: p.vendedorId, vendedorUsuarioId: p.vendedorUsuarioId, nombre: p.nombre,
      resumen: `Publicado: ${p.nombre} (${p.nombreTienda})`,
    }, ctx);
  }

  return {
    async listar(filtros, usuario) {
      const f = { ...filtros };
      // ?mios=1 → el vendedor ve todos sus productos, también los ocultos.
      if (filtros.mios && usuario?.rol === "vendedor") f.duenoUsuarioId = usuario.id;
      const { datos, total } = await repo.buscar(f);
      return { datos, pagina: f.pagina, porPagina: f.porPagina, total, totalPaginas: Math.ceil(total / f.porPagina) };
    },

    async ver(id, usuario) {
      const p = await repo.buscarPorId(id);
      const puedeVer = p && !p.eliminado && (esVisible(p) || esDueno(p, usuario) || usuario?.rol === "admin");
      if (!puedeVer) throw new ErrorNoEncontrado("Producto no encontrado");
      return p;
    },

    async crear(usuario, datos, ctx) {
      // El catálogo pregunta a vendedores (REST) si el puesto está aprobado:
      // necesita la respuesta YA para decidir, por eso no es un evento.
      let vendedor;
      try {
        vendedor = await clientes.vendedores.get(`/interno/vendedores/por-usuario/${usuario.id}`, ctx);
      } catch (e) {
        if (e instanceof ErrorApp && e.status === 404) throw new ErrorProhibido("Primero solicita abrir tu puesto");
        throw e;
      }
      if (vendedor.estado !== "APROBADO") throw new ErrorProhibido("Tu puesto aún no está aprobado");
      const id = randomUUID();
      const p = await repo.crear({
        id,
        ...datos,
        slug: crearSlug(datos.nombre),
        imagenes: datos.imagenes?.length ? datos.imagenes : [`/productos/${id}/imagen.svg`],
        vendedorId: vendedor.id,
        vendedorUsuarioId: usuario.id,
        nombreTienda: vendedor.nombreTienda,
        colorTienda: vendedor.color,
        ciudad: vendedor.ciudad,
        vendedorActivo: true,
        estadoStock: "agotado", // inventario crea el stock en 0 y avisa cuando cambie
        stockDisponible: 0,
      });
      if (p.publicado) avisarPublicado(p, ctx);
      return p;
    },

    async actualizar(id, usuario, datos) {
      await obtenerPropio(id, usuario);
      return repo.actualizar(id, { ...datos, slug: crearSlug(datos.nombre) });
    },

    async cambiarPublicacion(id, usuario, publicado, ctx) {
      const { publicado: estabaPublicado } = await obtenerPropio(id, usuario);
      const actualizado = await repo.actualizar(id, { publicado });
      if (publicado && !estabaPublicado) avisarPublicado(actualizado, ctx);
      return actualizado;
    },

    async eliminar(id, usuario) {
      const p = await repo.buscarPorId(id);
      if (!p || p.eliminado) throw new ErrorNoEncontrado("Producto no encontrado");
      if (!esDueno(p, usuario) && usuario.rol !== "admin") throw new ErrorProhibido("Solo el dueño o un administrador puede eliminarlo");
      await repo.actualizar(id, { eliminado: true, publicado: false });
    },

    async categorias() {
      const conteo = Object.fromEntries((await repo.contarPorCategoria()).map((c) => [c._id, c.cantidad]));
      return CATEGORIAS.map((c) => ({ ...c, cantidad: conteo[c.slug] || 0 }));
    },

    // Snapshot para carrito y pedidos (ruta interna).
    async porIds(ids) {
      return (await repo.buscarPorIds(ids)).map((p) => ({
        id: p.id, nombre: p.nombre, precio: p.precio, categoria: p.categoria, imagen: p.imagenes?.[0],
        vendedorId: p.vendedorId, vendedorUsuarioId: p.vendedorUsuarioId, nombreTienda: p.nombreTienda,
        colorTienda: p.colorTienda, publicado: p.publicado && p.vendedorActivo, eliminado: p.eliminado,
      }));
    },

    imagenDe: async (id) => {
      const p = await repo.buscarPorId(id);
      if (!p) throw new ErrorNoEncontrado("Producto no encontrado");
      return p;
    },
  };
}
