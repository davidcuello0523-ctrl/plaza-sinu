// Dobles de prueba: repositorio en memoria y bus que solo anota los eventos.
import { randomUUID } from "node:crypto";
import { crearLogger } from "@plaza/compartido";

export function repoEnMemoria(iniciales = []) {
  const datos = new Map(iniciales.map((v) => [v.id, { ...v }]));
  return {
    crear: async (d) => {
      const v = { id: randomUUID(), reputacion: 0, totalResenas: 0, creadoEn: new Date(), ...d };
      datos.set(v.id, v);
      return v;
    },
    buscarPorId: async (id) => datos.get(id) || null,
    buscarPorUsuario: async (u) => [...datos.values()].find((v) => v.usuarioId === u) || null,
    buscarPorSlug: async (s) => [...datos.values()].find((v) => v.slug === s) || null,
    actualizar: async (id, d) => Object.assign(datos.get(id), d),
    listar: async ({ estado, ciudad, categoria }) =>
      [...datos.values()].filter((v) => (!estado || v.estado === estado) && (!ciudad || v.ciudad === ciudad)
        && (!categoria || v.categoriaPrincipal === categoria)),
  };
}

export function busFalso() {
  const publicados = [];
  return { publicados, publicar: (tipo, datos) => publicados.push({ tipo, datos }), estaConectado: () => true };
}

export const logger = crearLogger("pruebas");
