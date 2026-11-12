export function crearRepositorioUsuarios(prisma) {
  return {
    buscarPorEmail: (email) => prisma.usuario.findUnique({ where: { email } }),
    buscarPorId: (id) => prisma.usuario.findUnique({ where: { id } }),
    crear: (datos) => prisma.usuario.create({ data: datos }),
    actualizar: (id, datos) => prisma.usuario.update({ where: { id }, data: datos }),
    listar: () => prisma.usuario.findMany({ orderBy: { creadoEn: "desc" } }),

    guardarRefresh: (datos) => prisma.refreshToken.create({ data: datos }),
    buscarRefresh: (tokenHash) => prisma.refreshToken.findUnique({ where: { tokenHash } }),
    revocarRefresh: (id) => prisma.refreshToken.update({ where: { id }, data: { revocadoEn: new Date() } }),
    revocarTodosRefresh: (usuarioId) =>
      prisma.refreshToken.updateMany({ where: { usuarioId, revocadoEn: null }, data: { revocadoEn: new Date() } }),
  };
}
