// Capa de acceso a datos (Prisma). Es la ÚNICA que conoce la base de datos.

export function crearRepositorioVendedores(prisma) {
  return {
    crear: (datos) => prisma.vendedor.create({ data: datos }),
    buscarPorId: (id) => prisma.vendedor.findUnique({ where: { id } }),
    buscarPorUsuario: (usuarioId) => prisma.vendedor.findUnique({ where: { usuarioId } }),
    buscarPorSlug: (slug) => prisma.vendedor.findUnique({ where: { slug } }),
    actualizar: (id, datos) => prisma.vendedor.update({ where: { id }, data: datos }),
    listar: ({ estado, ciudad, categoria }) =>
      prisma.vendedor.findMany({
        where: {
          ...(estado && { estado }),
          ...(ciudad && { ciudad }),
          ...(categoria && { categoriaPrincipal: categoria }),
        },
        orderBy: [{ reputacion: "desc" }, { creadoEn: "asc" }],
      }),
  };
}
