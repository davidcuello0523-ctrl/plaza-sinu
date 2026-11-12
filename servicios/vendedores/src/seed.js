import prismaPkg from "./generated/prisma/index.js";

const uid = (n) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;
export const vid = (n) => `00000000-0000-4000-c000-${String(n).padStart(12, "0")}`;

export const VENDEDORES_DEMO = [
  { id: vid(1), usuarioId: uid(101), nombreTienda: "Tecno Sinú", slug: "tecno-sinu", categoriaPrincipal: "tecnologia",
    ciudad: "Montería", color: "#1F6FB2", nit: "901234567-1", telefono: "3004561200", reputacion: 4.8, totalResenas: 214,
    descripcion: "Portátiles, audio y accesorios con garantía local. Soporte técnico en la avenida Primera de Montería." },
  { id: vid(2), usuarioId: uid(102), nombreTienda: "Rueda Libre", slug: "rueda-libre", categoriaPrincipal: "bicicletas",
    ciudad: "Montería", color: "#2F8F5B", nit: "901345678-2", telefono: "3015558821", reputacion: 4.7, totalResenas: 138,
    descripcion: "Bicicletas MTB y de ruta, repuestos y taller. Rodamos por la ronda del Sinú desde 2012." },
  { id: vid(3), usuarioId: uid(103), nombreTienda: "Hilo & Río", slug: "hilo-y-rio", categoriaPrincipal: "ropa",
    ciudad: "Cereté", color: "#B0457A", nit: "901456789-3", telefono: "3127784410", reputacion: 4.5, totalResenas: 96,
    descripcion: "Ropa fresca hecha en Cereté: lino, algodón y guayaberas para el calor del valle." },
  { id: vid(4), usuarioId: uid(104), nombreTienda: "Casa Ronda", slug: "casa-ronda", categoriaPrincipal: "hogar",
    ciudad: "Montería", color: "#8A5A2B", nit: "901567890-4", telefono: "3046612390", reputacion: 4.4, totalResenas: 77,
    descripcion: "Muebles, lámparas y menaje para la casa costeña. Entregas en Montería y alrededores." },
  { id: vid(5), usuarioId: uid(105), nombreTienda: "Taller Zenú", slug: "taller-zenu", categoriaPrincipal: "artesanias",
    ciudad: "Sahagún", color: "#C98A12", nit: "901678901-5", telefono: "3205501177", reputacion: 4.9, totalResenas: 302,
    descripcion: "Sombreros vueltiaos y tejidos en caña flecha hechos a mano por artesanos zenúes." },
  { id: vid(6), usuarioId: uid(106), nombreTienda: "Papelería El Lápiz", slug: "papeleria-el-lapiz", categoriaPrincipal: "papeleria",
    ciudad: "Lorica", color: "#3D6B7A", nit: "901789012-6", telefono: "3112093345", reputacion: 4.3, totalResenas: 64,
    descripcion: "Útiles escolares, cuadernos y oficina en el centro histórico de Lorica." },
  { id: vid(7), usuarioId: uid(107), nombreTienda: "Deportes Ribera", slug: "deportes-ribera", categoriaPrincipal: "deportes",
    ciudad: "Montería", color: "#C23B3B", nit: "901890123-7", telefono: "3018873302", reputacion: 4.6, totalResenas: 121,
    descripcion: "Balones, uniformes y accesorios para fútbol, softbol y running." },
  { id: vid(8), usuarioId: uid(108), nombreTienda: "Mercadito Tierralta", slug: "mercadito-tierralta", categoriaPrincipal: "hogar",
    ciudad: "Tierralta", color: "#6B7A2E", nit: "901901234-8", telefono: "3009917745", reputacion: 4.1, totalResenas: 0,
    descripcion: "Productos del hogar y del campo del Alto Sinú. Solicitud en revisión.", estado: "PENDIENTE" },
];

export async function sembrar(prisma) {
  for (const v of VENDEDORES_DEMO) {
    const datos = { estado: "APROBADO", aprobadoEn: new Date(), ...v };
    if (datos.estado !== "APROBADO") datos.aprobadoEn = null;
    await prisma.vendedor.upsert({ where: { id: v.id }, update: {}, create: datos });
  }
  return VENDEDORES_DEMO.length;
}

if (process.argv[1]?.endsWith("seed.js")) {
  const prisma = new prismaPkg.PrismaClient();
  console.log(`vendedores: ${await sembrar(prisma)} puestos de demostración listos`);
  await prisma.$disconnect();
}
