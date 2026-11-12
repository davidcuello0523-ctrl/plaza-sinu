export function crearControlador(servicio, hub) {
  return {
    listar: async (req, res) => {
      const { pagina, porPagina, noLeidas } = req.validado.query;
      const { datos, total, noLeidas: contador } = await servicio.listar(req.usuario.id, { soloNoLeidas: noLeidas, pagina, porPagina });
      res.json({ datos, pagina, porPagina, total, totalPaginas: Math.ceil(total / porPagina), noLeidas: contador });
    },
    marcarLeida: async (req, res) => res.json(await servicio.marcarLeida(req.params.id, req.usuario.id)),
    leerTodas: async (req, res) => res.json(await servicio.marcarTodas(req.usuario.id)),

    stream: async (req, res) => {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
      res.write("retry: 3000\n\n");
      const desconectar = hub.conectar(req.usuario.id, res);
      res.write(`event: hola\ndata: ${JSON.stringify({ noLeidas: await servicio.contarNoLeidas(req.usuario.id) })}\n\n`);
      const latido = setInterval(() => res.write(": latido\n\n"), 25000);
      req.on("close", () => { clearInterval(latido); desconectar(); });
    },
  };
}
