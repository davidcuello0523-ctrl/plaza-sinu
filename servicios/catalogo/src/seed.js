import mongoose from "mongoose";
import { FOTOS, rutaFoto } from "./fotos.js";
import { Producto } from "./modelos/producto.modelo.js";
import { estadoDeStock } from "./categorias.js";

const uid = (n) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
const vid = (n) => `00000000-0000-4000-c000-${String(n).padStart(12, "0")}`;

const PUESTOS = [
  { n: 1, tienda: "Tecno Sinú", color: "#1F6FB2", ciudad: "Montería", categoria: "tecnologia" },
  { n: 2, tienda: "Rueda Libre", color: "#2F8F5B", ciudad: "Montería", categoria: "bicicletas" },
  { n: 3, tienda: "Hilo & Río", color: "#B0457A", ciudad: "Cereté", categoria: "ropa" },
  { n: 4, tienda: "Casa Ronda", color: "#8A5A2B", ciudad: "Montería", categoria: "hogar" },
  { n: 5, tienda: "Taller Zenú", color: "#C98A12", ciudad: "Sahagún", categoria: "artesanias" },
  { n: 6, tienda: "Papelería El Lápiz", color: "#3D6B7A", ciudad: "Lorica", categoria: "papeleria" },
  { n: 7, tienda: "Deportes Ribera", color: "#C23B3B", ciudad: "Montería", categoria: "deportes" },
];

const PRODUCTOS = [
  ['Portátil Lenovo IdeaPad 15" Ryzen 5', 2499000, "Pantalla de 15,6\", ideal para estudio y teletrabajo. Entrega e instalación en Montería.", { marca: "Lenovo", memoria: "16 GB RAM / 512 GB SSD", voltaje: "110-240 V", garantiaMeses: 12 }],
  ["Audífonos inalámbricos Sinú Bass", 189000, "Bluetooth 5.3, 30 horas de batería y graves potentes para el picó de la casa.", { marca: "Sinú Audio", memoria: "N/A", voltaje: "5 V USB-C", garantiaMeses: 6 }],
  ['Monitor 24" Full HD', 649000, "Panel IPS de 75 Hz con bordes delgados. Última unidad en vitrina.", { marca: "AOC", memoria: "N/A", voltaje: "110 V", garantiaMeses: 12 }],
  ["Celular Xiaomi Redmi Note 13 128 GB", 899000, "Cámara de 108 MP, pantalla AMOLED y carga rápida de 33 W.", { marca: "Xiaomi", memoria: "8 GB / 128 GB", voltaje: "5 V", garantiaMeses: 12 }],
  ["Parlante Bluetooth resistente al agua", 249000, "Certificación IPX7: llévalo a la ronda del Sinú o a la playa de Coveñas.", { marca: "Sinú Audio", memoria: "N/A", voltaje: "5 V USB-C", garantiaMeses: 6 }],
  ["Teclado mecánico retroiluminado", 279000, "Switches rojos, distribución en español y luz RGB.", { marca: "Redragon", memoria: "N/A", voltaje: "5 V USB", garantiaMeses: 12 }],
  ["Router Wi-Fi 6 doble banda", 329000, "Cobertura para casa de dos pisos, fácil de configurar desde el celular.", { marca: "TP-Link", memoria: "N/A", voltaje: "110-240 V", garantiaMeses: 24 }],
  ["Bicicleta MTB rin 29 Shimano", 1850000, "Marco de aluminio, frenos de disco hidráulicos y suspensión delantera.", { rin: "29", talla: "M", material: "Aluminio", cambios: "3x8 Shimano" }],
  ["Casco MTB ventilado", 159000, "18 ventilaciones y visera removible. Quedan muy pocas unidades.", { rin: "N/A", talla: "M/L", material: "EPS + policarbonato", cambios: "N/A" }],
  ["Luces LED delantera y trasera recargables", 89000, "Kit de luces USB con 5 modos para rodar de noche con seguridad.", { rin: "Universal", talla: "Única", material: "Silicona", cambios: "N/A" }],
  ["Candado en U de alta seguridad", 119000, "Acero endurecido con soporte para el marco y dos llaves.", { rin: "Universal", talla: "Única", material: "Acero", cambios: "N/A" }],
  ["Bicicleta urbana rin 26 con canasta", 980000, "Cómoda para ir al centro o al mercado: guardabarros, parrilla y canasta.", { rin: "26", talla: "Única", material: "Acero", cambios: "1x7 Shimano" }],
  ["Guantes de ciclismo dedo corto", 59000, "Palma acolchada con gel y tejido transpirable.", { rin: "N/A", talla: "M", material: "Lycra y gel", cambios: "N/A" }],
  ["Bomba de piso con manómetro", 129000, "Válvula dual Presta/Schrader, hasta 160 psi.", { rin: "Universal", talla: "Única", material: "Aluminio", cambios: "N/A" }],
  ["Guayabera de lino blanca", 185000, "Confeccionada en Cereté, fresca para el calor del valle del Sinú.", { talla: "M", color: "Blanco", material: "Lino" }],
  ["Camisa de algodón manga corta", 89000, "Corte clásico, 100 % algodón, varios colores.", { talla: "L", color: "Azul río", material: "Algodón" }],
  ["Vestido fresco estampado sinuano", 149000, "Estampado de flores de corozo y bocachico, tela liviana.", { talla: "S", color: "Naranja", material: "Viscosa" }],
  ["Pantalón de lino beige", 139000, "Bota recta con pretina elástica.", { talla: "32", color: "Beige", material: "Lino" }],
  ['Camiseta "Ronda del Sinú"', 55000, "Ilustración de la ronda del río estampada a mano.", { talla: "M", color: "Blanco", material: "Algodón" }],
  ["Falda midi de algodón", 99000, "Falda con bolsillos y botones de coco. Agotada por ahora.", { talla: "M", color: "Terracota", material: "Algodón" }],
  ["Bermuda de dril", 79000, "Dril resistente con cinco bolsillos.", { talla: "34", color: "Caqui", material: "Dril" }],
  ["Lámpara de mimbre colgante", 210000, "Tejida a mano, luz cálida para el comedor o la terraza.", { material: "Mimbre", medidas: "40 × 35 cm" }],
  ["Hamaca sanjacintera doble", 320000, "Tejida en telar tradicional, con flecos de colores.", { material: "Algodón", medidas: "3,2 × 1,6 m" }],
  ["Juego de 6 vasos de vidrio soplado", 95000, "Vidrio reciclado con borde azul.", { material: "Vidrio", medidas: "350 ml c/u" }],
  ["Mecedora momposina en hierro", 690000, "Clásica mecedora de terraza costeña, tejido plástico resistente al sol.", { material: "Hierro y PVC", medidas: "95 × 60 × 110 cm" }],
  ['Ventilador de pie 18"', 239000, "Tres velocidades, oscilación y control remoto. Imprescindible en Montería.", { material: "Plástico y metal", medidas: '18" / 1,3 m de alto' }],
  ["Juego de sábanas algodón doble", 159000, "200 hilos, incluye dos fundas.", { material: "Algodón", medidas: "Doble 140 × 190 cm" }],
  ["Olla de barro grande", 85000, "Para sancocho de bocachico. Curada y lista para usar.", { material: "Barro", medidas: "6 litros" }],
  ["Sombrero vueltiao 19 vueltas", 420000, "Tejido a mano en caña flecha por artesanos de Tuchín. Pieza fina.", { tecnica: "Trenzado en caña flecha", origen: "Tuchín, Córdoba", vueltas: 19 }],
  ["Mochila zenú en caña flecha", 135000, "Diseños tradicionales zenúes, correa ajustable. Últimas unidades.", { tecnica: "Tejido en caña flecha", origen: "San Andrés de Sotavento", vueltas: "N/A" }],
  ["Sombrero vueltiao 15 vueltas", 210000, "El clásico para el día a día, flexible y resistente.", { tecnica: "Trenzado en caña flecha", origen: "Tuchín, Córdoba", vueltas: 15 }],
  ["Pulsera en caña flecha", 25000, "Tejido pinta zenú, ideal para regalo.", { tecnica: "Trenzado fino", origen: "Tuchín, Córdoba", vueltas: "N/A" }],
  ["Abanico tejido zenú", 45000, "Abanico de mano tejido con figuras tradicionales.", { tecnica: "Tejido en palma y caña flecha", origen: "Sahagún, Córdoba", vueltas: "N/A" }],
  ["Individuales tejidos (juego x4)", 98000, "Cuatro individuales redondos para la mesa.", { tecnica: "Tejido en caña flecha", origen: "Tuchín, Córdoba", vueltas: "N/A" }],
  ["Sombrero vueltiao 23 vueltas fino", 980000, "Pieza de colección, tejido extra fino que se dobla sin dañarse.", { tecnica: "Trenzado extra fino", origen: "Tuchín, Córdoba", vueltas: 23 }],
  ["Cuaderno argollado 100 hojas", 12500, "Cuadriculado, tapa dura con ilustraciones de Lorica.", { presentacion: "Tapa dura", unidades: 1 }],
  ["Caja de colores x24", 32000, "Colores de mina suave, incluye sacapuntas.", { presentacion: "Caja", unidades: 24 }],
  ["Kit escolar básico", 69000, "Cuadernos, lápices, borrador, regla y colores para primaria.", { presentacion: "Kit", unidades: 12 }],
  ["Resma papel carta 500 hojas", 28000, "75 g, blancura alta para impresora láser o de tinta.", { presentacion: "Resma", unidades: 500 }],
  ["Agenda 2027 tapa cuero", 45000, "Semana a la vista con calendario festivo de Colombia.", { presentacion: "Tapa sintética", unidades: 1 }],
  ["Marcadores borrables x12", 38000, "Para tablero acrílico, tinta de secado rápido.", { presentacion: "Estuche", unidades: 12 }],
  ["Calculadora científica", 89000, "252 funciones, ideal para bachillerato y universidad.", { presentacion: "Unidad", unidades: 1 }],
  ["Balón de fútbol No. 5 cosido", 119000, "Cosido a mano, para grama natural o sintética.", { talla: "5", deporte: "Fútbol" }],
  ["Guayos para grama sintética", 229000, "Suela multitaco con buen agarre.", { talla: "41", deporte: "Fútbol" }],
  ['Guante de softbol 12"', 179000, "Cuero sintético, para jardinero o cuadro.", { talla: '12"', deporte: "Softbol" }],
  ["Uniforme de fútbol completo", 99000, "Camiseta, pantaloneta y medias. Personalizable con número.", { talla: "M", deporte: "Fútbol" }],
  ["Tenis para running", 289000, "Amortiguación ligera para correr en la avenida Primera.", { talla: "40", deporte: "Running" }],
  ["Termo deportivo 1 L", 49000, "Acero inoxidable, mantiene el agua fría 24 horas.", { talla: "1 L", deporte: "Multideporte" }],
];

const ESPECIALES = { 9: 2, 3: 1, 30: 2, 20: 0 };
export const stockInicial = (i) => (i in ESPECIALES ? ESPECIALES[i] : 5 + ((i * 7) % 36));

const crearSlug = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function productosDemo(ahora = Date.now()) {
  return PRODUCTOS.map(([nombre, precio, descripcion, atributos], k) => {
    const i = k + 1;
    const id = `prd-${String(i).padStart(3, "0")}`;
    const puesto = PUESTOS[Math.min(Math.floor(k / 7), 6)];
    const disponible = stockInicial(i);
    const fecha = new Date(ahora - (PRODUCTOS.length - i) * 6 * 3600 * 1000);
    return {
      _id: id, nombre, slug: crearSlug(nombre), descripcion, precio, categoria: puesto.categoria, atributos,
      imagenes: FOTOS.has(id) ? [rutaFoto(id), `/productos/${id}/imagen.svg`] : [`/productos/${id}/imagen.svg`],
      vendedorId: vid(puesto.n), vendedorUsuarioId: uid(100 + puesto.n), nombreTienda: puesto.tienda,
      colorTienda: puesto.color, ciudad: puesto.ciudad,
      publicado: true, eliminado: false, vendedorActivo: true,
      estadoStock: estadoDeStock(disponible), stockDisponible: disponible,
      creadoEn: fecha, actualizadoEn: fecha,
    };
  });
}

export async function sincronizarFotos() {
  const ops = [...FOTOS].map((id) => ({
    updateOne: { filter: { _id: id, imagenes: { $ne: rutaFoto(id) } }, update: { $push: { imagenes: { $each: [rutaFoto(id)], $position: 0 } } } },
  }));
  if (!ops.length) return 0;
  return (await Producto.collection.bulkWrite(ops)).modifiedCount;
}

export async function sembrar() {
  const ops = productosDemo().map((p) => ({ updateOne: { filter: { _id: p._id }, update: { $setOnInsert: p }, upsert: true } }));
  await Producto.collection.bulkWrite(ops);
  return ops.length;
}

if (process.argv[1]?.endsWith("seed.js")) {
  await mongoose.connect(process.env.MONGO_URL || "mongodb://localhost:27018/catalogo");
  console.log(`catalogo: ${await sembrar()} productos de demostración listos`);
  await mongoose.disconnect();
}
