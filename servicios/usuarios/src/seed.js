import bcrypt from "bcryptjs";
import prismaPkg from "./generated/prisma/index.js";

export const CLAVE_DEMO = "Demo123*";
const id = (n) => `00000000-0000-4000-a000-${String(n).padStart(12, "0")}`;

export const USUARIOS_DEMO = [
  { id: id(1), nombre: "Administración Plaza Sinú", email: "admin@plazasinu.co", rol: "admin", ciudad: "Montería" },
  { id: id(2), nombre: "Pacho", email: "pacho@plazasinu.co", rol: "admin", ciudad: "Montería", clave: process.env.CLAVE_ADMIN_PACHO },
  { id: id(11), nombre: "Laura Petro", email: "cliente@plazasinu.co", rol: "cliente", ciudad: "Montería" },
  { id: id(12), nombre: "Andrés Doria", email: "cliente2@plazasinu.co", rol: "cliente", ciudad: "Cereté" },
  { id: id(13), nombre: "Valentina Hoyos", email: "cliente3@plazasinu.co", rol: "cliente", ciudad: "Lorica" },
  { id: id(14), nombre: "Camilo Negrete", email: "cliente4@plazasinu.co", rol: "cliente", ciudad: "Sahagún" },
  { id: id(101), nombre: "Mario Arrieta", email: "vendedor@plazasinu.co", rol: "vendedor", ciudad: "Montería" },
  { id: id(102), nombre: "Diana Lambraño", email: "bicis@plazasinu.co", rol: "vendedor", ciudad: "Montería" },
  { id: id(103), nombre: "Rosa Contreras", email: "ropa@plazasinu.co", rol: "vendedor", ciudad: "Cereté" },
  { id: id(104), nombre: "Jorge Espitia", email: "hogar@plazasinu.co", rol: "vendedor", ciudad: "Montería" },
  { id: id(105), nombre: "Ana Suárez Zenú", email: "artesanias@plazasinu.co", rol: "vendedor", ciudad: "Sahagún" },
  { id: id(106), nombre: "Luis Pacheco", email: "papeleria@plazasinu.co", rol: "vendedor", ciudad: "Lorica" },
  { id: id(107), nombre: "Karen Ruiz", email: "deportes@plazasinu.co", rol: "vendedor", ciudad: "Montería" },
  { id: id(108), nombre: "Pedro Banda", email: "pendiente@plazasinu.co", rol: "vendedor", ciudad: "Tierralta" },
];

export async function sembrar(prisma) {
  const hashClave = await bcrypt.hash(CLAVE_DEMO, 10);
  for (const { clave, ...u } of USUARIOS_DEMO) {
    if (u.email === "pacho@plazasinu.co" && !clave) continue;
    const hash = clave ? await bcrypt.hash(clave, 10) : hashClave;
    await prisma.usuario.upsert({ where: { id: u.id }, update: {}, create: { ...u, hashClave: hash } });
  }
  return USUARIOS_DEMO.length;
}

if (process.argv[1]?.endsWith("seed.js")) {
  const prisma = new prismaPkg.PrismaClient();
  const n = await sembrar(prisma);
  console.log(`usuarios: ${n} usuarios de demostración listos (clave ${CLAVE_DEMO})`);
  await prisma.$disconnect();
}
