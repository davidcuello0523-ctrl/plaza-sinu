// Conexiones SSE abiertas por usuario. SSE (y no WebSocket) porque el flujo es
// de una sola vía: el servidor avisa, el navegador solo escucha.
// shortcut: el Map vive en memoria de UNA instancia; con réplicas haría falta Redis pub/sub.

export function crearHub() {
  const conexiones = new Map(); // usuarioId → Set(res)

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
