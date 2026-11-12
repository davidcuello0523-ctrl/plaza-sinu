import { jest } from "@jest/globals";
import { crearRepositorioInventario } from "../src/repositorio/inventario.repositorio.js";

const url = process.env.DATABASE_URL_PRUEBAS;
const describir = url ? describe : describe.skip;
jest.setTimeout(20000);

describir("concurrencia sobre Postgres", () => {
  let prisma, repo;
  const productoId = `prueba-${Date.now()}`;

  beforeAll(async () => {
    const { default: prismaPkg } = await import("../src/generated/prisma/index.js");
    prisma = new prismaPkg.PrismaClient({ datasourceUrl: url });
    repo = crearRepositorioInventario(prisma);
    await prisma.stock.create({ data: { productoId, nombreProducto: "Última unidad", fisico: 1 } });
  });

  afterAll(async () => {
    await prisma.reservaItem.deleteMany({ where: { productoId } });
    await prisma.reserva.deleteMany({ where: { pedidoId: { startsWith: productoId } } });
    await prisma.movimiento.deleteMany({ where: { productoId } });
    await prisma.stock.delete({ where: { productoId } });
    await prisma.$disconnect();
  });

  test("dos clientes compran la última unidad a la vez → uno 201, otro 409", async () => {
    const venceEn = new Date(Date.now() + 60_000);
    const items = [{ productoId, cantidad: 1 }];
    const resultados = await Promise.allSettled([
      repo.reservar({ pedidoId: `${productoId}-a`, items, venceEn }),
      repo.reservar({ pedidoId: `${productoId}-b`, items, venceEn }),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(resultados.find((r) => r.status === "rejected").reason.status).toBe(409);
    expect(await prisma.stock.findUnique({ where: { productoId } })).toMatchObject({ fisico: 1, reservado: 1 });
  });
});
