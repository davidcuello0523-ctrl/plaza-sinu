import { crearClienteHttp } from "@plaza/compartido";

export function crearClientes() {
  const catalogo = crearClienteHttp({ servicio: "catalogo", urlBase: process.env.CATALOGO_URL || "http://localhost:4003" });
  const inventario = crearClienteHttp({ servicio: "inventario", urlBase: process.env.INVENTARIO_URL || "http://localhost:4004", timeoutMs: 1500 });
  return {
    async productos(ids, ctx) {
      const r = await catalogo.get(`/interno/productos?ids=${ids.map(encodeURIComponent).join(",")}`, ctx);
      return r.datos;
    },
    async disponibilidad(items, ctx) {
      const r = await inventario.post("/inventario/disponibilidad", { items }, ctx);
      return r.datos;
    },
  };
}
