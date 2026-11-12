import { crearClienteHttp } from "@plaza/compartido";

export function crearClientes() {
  return {
    carrito: crearClienteHttp({ servicio: "carrito", urlBase: process.env.CARRITO_URL || "http://localhost:4005", timeoutMs: 5000 }),
    catalogo: crearClienteHttp({ servicio: "catalogo", urlBase: process.env.CATALOGO_URL || "http://localhost:4003" }),
    inventario: crearClienteHttp({ servicio: "inventario", urlBase: process.env.INVENTARIO_URL || "http://localhost:4004", timeoutMs: 5000 }),
  };
}
