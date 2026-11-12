import prismaPkg from "./generated/prisma/index.js";

const ESPECIALES = { 9: 2, 3: 1, 30: 2, 20: 0 };
export const stockInicial = (i) => ESPECIALES[i] ?? 5 + ((i * 7) % 36);

const NOMBRES = {
  1: "Portátil Lenovo IdeaPad 15\" Ryzen 5",
  2: "Audífonos inalámbricos Sinú Bass",
  3: "Monitor 24\" Full HD",
  4: "Celular Xiaomi Redmi Note 13 128 GB",
  5: "Parlante Bluetooth resistente al agua",
  6: "Teclado mecánico retroiluminado",
  7: "Router Wi-Fi 6 doble banda",
  8: "Bicicleta MTB rin 29 Shimano",
  9: "Casco MTB ventilado",
  10: "Luces LED delantera y trasera recargables",
  11: "Candado en U de alta seguridad",
  12: "Bicicleta urbana rin 26 con canasta",
  13: "Guantes de ciclismo dedo corto",
  14: "Bomba de piso con manómetro",
  15: "Guayabera de lino blanca",
  16: "Camisa de algodón manga corta",
  17: "Vestido fresco estampado sinuano",
  18: "Pantalón de lino beige",
  19: "Camiseta \"Ronda del Sinú\"",
  20: "Falda midi de algodón",
  21: "Bermuda de dril",
  22: "Lámpara de mimbre colgante",
  23: "Hamaca sanjacintera doble",
  24: "Juego de 6 vasos de vidrio soplado",
  25: "Mecedora momposina en hierro",
  26: "Ventilador de pie 18\"",
  27: "Juego de sábanas algodón doble",
  28: "Olla de barro grande",
  29: "Sombrero vueltiao 19 vueltas",
  30: "Mochila zenú en caña flecha",
  31: "Sombrero vueltiao 15 vueltas",
  32: "Pulsera en caña flecha",
  33: "Abanico tejido zenú",
  34: "Individuales tejidos (juego x4)",
  35: "Sombrero vueltiao 23 vueltas fino",
  36: "Cuaderno argollado 100 hojas",
  37: "Caja de colores x24",
  38: "Kit escolar básico",
  39: "Resma papel carta 500 hojas",
  40: "Agenda 2027 tapa cuero",
  41: "Marcadores borrables x12",
  42: "Calculadora científica",
  43: "Balón de fútbol No. 5 cosido",
  44: "Guayos para grama sintética",
  45: "Guante de softbol 12\"",
  46: "Uniforme de fútbol completo",
  47: "Tenis para running",
  48: "Termo deportivo 1 L",
};
const CATEGORIAS = ["tecnología", "bicicletas", "ropa", "hogar", "artesanías", "papelería", "deportes"];

const usuarioVendedor = (i) => `00000000-0000-4000-a000-${String(100 + Math.ceil(i / 7)).padStart(12, "0")}`;

export const STOCK_DEMO = Array.from({ length: 48 }, (_, k) => {
  const i = k + 1;
  return {
    productoId: `prd-${String(i).padStart(3, "0")}`,
    vendedorUsuarioId: usuarioVendedor(i),
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
