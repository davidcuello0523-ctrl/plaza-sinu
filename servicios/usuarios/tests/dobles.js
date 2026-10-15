// Dobles de prueba: repositorio en memoria y bus que solo anota los eventos.
import { randomUUID } from "node:crypto";
import { crearLogger } from "@plaza/compartido";

export function repoEnMemoria() {
  const usuarios = new Map();
  const tokens = new Map();
  return {
    buscarPorEmail: async (email) => [...usuarios.values()].find((u) => u.email === email) || null,
    buscarPorId: async (id) => usuarios.get(id) || null,
    crear: async (d) => {
      const u = { id: randomUUID(), rol: "cliente", activo: true, creadoEn: new Date(), ...d };
      usuarios.set(u.id, u);
      return u;
    },
    actualizar: async (id, d) => Object.assign(usuarios.get(id), d),
    listar: async () => [...usuarios.values()],
    guardarRefresh: async (d) => tokens.set(d.tokenHash, { id: randomUUID(), revocadoEn: null, ...d }),
    buscarRefresh: async (h) => tokens.get(h) || null,
    revocarRefresh: async (id) => { for (const t of tokens.values()) if (t.id === id) t.revocadoEn = new Date(); },
    revocarTodosRefresh: async (uid) => { for (const t of tokens.values()) if (t.usuarioId === uid) t.revocadoEn = new Date(); },
  };
}

export function busFalso() {
  const publicados = [];
  return { publicados, publicar: (tipo, datos) => publicados.push({ tipo, datos }), estaConectado: () => true };
}

export const logger = crearLogger("pruebas");
