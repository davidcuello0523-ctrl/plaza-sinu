import { Correo, EventoProcesado, Notificacion } from "./modelos.js";

const plano = (doc) => {
  if (!doc) return null;
  const { _id, ...resto } = doc;
  return { id: String(_id), ...resto };
};

export function crearRepositorioNotificaciones() {
  return {
    async listar(usuarioId, { soloNoLeidas, pagina, porPagina }) {
      const filtro = { usuarioId, ...(soloNoLeidas && { leida: false }) };
      const [docs, total, noLeidas] = await Promise.all([
        Notificacion.find(filtro).sort({ creadoEn: -1 }).skip((pagina - 1) * porPagina).limit(porPagina).lean(),
        Notificacion.countDocuments(filtro),
        Notificacion.countDocuments({ usuarioId, leida: false }),
      ]);
      return { datos: docs.map(plano), total, noLeidas };
    },
    contarNoLeidas: (usuarioId) => Notificacion.countDocuments({ usuarioId, leida: false }),
    async buscarPorId(id) {
      if (!/^[a-f0-9]{24}$/i.test(id)) return null;
      return plano(await Notificacion.findById(id).lean());
    },
    async marcarLeida(id) {
      return plano(await Notificacion.findByIdAndUpdate(id, { leida: true }, { new: true }).lean());
    },
    async marcarTodas(usuarioId) {
      const r = await Notificacion.updateMany({ usuarioId, leida: false }, { leida: true });
      return r.modifiedCount;
    },
    async crear(datos) {
      return plano((await Notificacion.create(datos)).toObject());
    },
    guardarCorreo: (datos) => Correo.create(datos),
    procesados: {
      existe: async (id) => Boolean(await EventoProcesado.exists({ _id: id })),
      guardar: (id, tipo) => EventoProcesado.updateOne({ _id: id }, { tipo, procesadoEn: new Date() }, { upsert: true }),
    },
    contar: () => Notificacion.estimatedDocumentCount(),
  };
}
