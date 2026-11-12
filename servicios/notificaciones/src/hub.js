export function crearHub() {
  const conexiones = new Map();

  return {
    conectar(usuarioId, res) {
      if (!conexiones.has(usuarioId)) conexiones.set(usuarioId, new Set());
      conexiones.get(usuarioId).add(res);
      return () => {
        const set = conexiones.get(usuarioId);
        set?.delete(res);
        if (set?.size === 0) conexiones.delete(usuarioId);
      };
    },
    enviar(usuarioId, evento, datos) {
      for (const res of conexiones.get(usuarioId) || []) res.write(`event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`);
    },
    conectados: () => [...conexiones.values()].reduce((n, s) => n + s.size, 0),
  };
}
