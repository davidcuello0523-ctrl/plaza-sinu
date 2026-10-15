// Llamadas REST a otros servicios: catálogo (precio y datos actuales) e
// inventario (disponibilidad). Síncronas porque el cliente necesita la
// respuesta para seguir comprando.
import { crearClienteHttp } from "@plaza/compartido";

export function crearClientes() {
  const catalogo = crearClienteHttp({ servicio: "catalogo", urlBase: process.env.CATALOGO_URL || "http://localhost:4003" });
  // Timeout corto: si inventario no responde, el carrito se muestra igual (sin verificar stock) antes de que venza el de quien nos llama.
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
