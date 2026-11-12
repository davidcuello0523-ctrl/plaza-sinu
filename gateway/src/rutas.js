export const SERVICIOS = {
  usuarios: { url: process.env.USUARIOS_URL || "http://localhost:4001", prefijos: ["/auth", "/usuarios"] },
  vendedores: { url: process.env.VENDEDORES_URL || "http://localhost:4002", prefijos: ["/vendedores"] },
  catalogo: { url: process.env.CATALOGO_URL || "http://localhost:4003", prefijos: ["/productos", "/categorias"] },
  inventario: { url: process.env.INVENTARIO_URL || "http://localhost:4004", prefijos: ["/inventario"] },
  carrito: { url: process.env.CARRITO_URL || "http://localhost:4005", prefijos: ["/carrito"] },
  "pedidos-pagos": { url: process.env.PEDIDOS_URL || "http://localhost:4006", prefijos: ["/pedidos", "/metricas"] },
  notificaciones: { url: process.env.NOTIFICACIONES_URL || "http://localhost:4007", prefijos: ["/notificaciones"] },
};

const empieza = (ruta, prefijo) => ruta === prefijo || ruta.startsWith(prefijo + "/");

export function servicioDe(ruta) {
  return Object.keys(SERVICIOS).find((nombre) => SERVICIOS[nombre].prefijos.some((p) => empieza(ruta, p)));
}

export function esPublica(metodo, ruta) {
  if (metodo === "POST" && ["/auth/login", "/auth/registro", "/auth/refresh", "/auth/logout"].includes(ruta)) return true;
  if (metodo !== "GET") return false;
  if (empieza(ruta, "/productos") || empieza(ruta, "/categorias")) return true;
  if (ruta === "/vendedores" || (/^\/vendedores\/[^/]+$/.test(ruta) && ruta !== "/vendedores/yo")) return true;
  if (/^\/inventario\/[^/]+$/.test(ruta)) return true;
  return false;
}

export function esInterna(ruta) {
  return ruta.includes("/interno/") || ruta.endsWith("/interno");
}
