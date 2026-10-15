// Stock de demostración para prd-001 … prd-048 (regla de docs/contratos.md §5).
// Catálogo usa la MISMA regla para su bandera inicial de disponibilidad.
// Uso: npm run seed  (o automático al arrancar con SEED_DEMO=true y BD vacía)
import prismaPkg from "./generated/prisma/index.js";

const ESPECIALES = { 9: 2, 3: 1, 30: 2, 20: 0 };
export const stockInicial = (i) => ESPECIALES[i] ?? 5 + ((i * 7) % 36);

const NOMBRES = {
  1: "Portátil Lenovo IdeaPad 15\" Ryzen 5",
  2: "Audífonos inalámbricos Sinú Bass",
  3: "Monitor 24\" Full HD",
  8: "Bicicleta MTB rin 29 Shimano",
  9: "Casco MTB ventilado",
  29: "Sombrero vueltiao 19 vueltas",
  30: "Mochila zenú en caña flecha",
};
const CATEGORIAS = ["tecnología", "bicicletas", "ropa", "hogar", "artesanías", "papelería", "deportes"];

const usuarioVendedor = (i) => `00000000-0000-4000-a000-${String(100 + Math.ceil(i / 7)).padStart(12, "0")}`;

export const STOCK_DEMO = Array.from({ length: 48 }, (_, k) => {
  const i = k + 1;
  return {
    productoId: `prd-${String(i).padStart(3, "0")}`,
    vendedorUsuarioId: usuarioVendedor(i),
    // shortcut: nombre genérico para los no listados; producto.publicado lo reemplaza si catálogo lo publica
    nombreProducto: NOMBRES[i] ?? `Artículo de ${CATEGORIAS[Math.ceil(i / 7) - 1]} ${String(i).padStart(3, "0")}`,
    fisico: stockInicial(i),
    reservado: 0,
    umbral: 3,
  };
});

export async function sembrar(prisma) {
  const existentes = new Set((await prisma.stock.findMany({ select: { productoId: true } })).map((s) => s.productoId));
  const nuevos = STOCK_DEMO.filter((s) => !existentes.has(s.productoId));
  await prisma.stock.createMany({ data: nuevos });
  await prisma.movimiento.createMany({
    data: nuevos.map((s) => ({
      productoId: s.productoId, tipo: "ENTRADA", cantidad: s.fisico, saldoFisico: s.fisico,
      saldoDisponible: s.fisico, referencia: "seed", nota: "Inventario inicial de demostración",
    })),
  });
  return nuevos.length;
}

if (process.argv[1]?.endsWith("seed.js")) {
  const prisma = new prismaPkg.PrismaClient();
  console.log(`inventario: ${await sembrar(prisma)} registros de stock creados`);
  await prisma.$disconnect();
}
