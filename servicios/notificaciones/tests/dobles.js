import { crearLogger } from "@plaza/compartido";

export function repoEnMemoria() {
  const notificaciones = [];
  const correos = [];
  const procesados = new Set();
  let sec = 0;
  return {
    notificaciones,
    correos,
    async listar(usuarioId, { soloNoLeidas, pagina, porPagina }) {
      const propias = notificaciones.filter((n) => n.usuarioId === usuarioId);
      const filtradas = propias.filter((n) => !soloNoLeidas || !n.leida);
      return {
        datos: filtradas.slice((pagina - 1) * porPagina, pagina * porPagina),
        total: filtradas.length,
        noLeidas: propias.filter((n) => !n.leida).length,
      };
    },
    contarNoLeidas: async (u) => notificaciones.filter((n) => n.usuarioId === u && !n.leida).length,
    buscarPorId: async (id) => notificaciones.find((n) => n.id === id) || null,
    marcarLeida: async (id) => Object.assign(notificaciones.find((n) => n.id === id), { leida: true }),
    async marcarTodas(u) {
      const pendientes = notificaciones.filter((n) => n.usuarioId === u && !n.leida);
      pendientes.forEach((n) => { n.leida = true; });
      return pendientes.length;
    },
    async crear(d) {
      const n = { id: String(++sec).padStart(24, "0"), leida: false, creadoEn: new Date(), ...d };
      notificaciones.push(n);
      return n;
    },
    guardarCorreo: async (c) => correos.push(c),
    procesados: { existe: async (id) => procesados.has(id), guardar: async (id) => procesados.add(id) },
    contar: async () => notificaciones.length,
  };
}

export function busFalso() {
  const publicados = [];
  return { publicados, publicar: (tipo, datos, opciones) => publicados.push({ tipo, datos, opciones }), estaConectado: () => true };
}

export function respuestaFalsa() {
  const escrito = [];
  return { escrito, write: (t) => escrito.push(t) };
}

export const logger = crearLogger("pruebas");
