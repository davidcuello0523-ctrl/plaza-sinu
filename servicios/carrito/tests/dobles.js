// Dobles de prueba: Redis en memoria y catálogo/inventario falsos.
import { ErrorServicioNoDisponible, crearLogger } from "@plaza/compartido";

export function repoEnMemoria() {
  const carritos = new Map();
  const eventos = new Set();
  return {
    obtener: async (u) => structuredClone(carritos.get(u) || { items: [], actualizadoEn: null }),
    guardar: async (u, items) => {
      const c = { items: structuredClone(items), actualizadoEn: new Date().toISOString() };
      carritos.set(u, c);
      return c;
    },
    eliminar: async (u) => carritos.delete(u),
    eventoProcesado: async (id) => eventos.has(id),
    marcarEvento: async (id) => eventos.add(id),
  };
}

export const PRODUCTOS = [
  { id: "prd-009", nombre: "Casco MTB ventilado", precio: 159000, categoria: "bicicletas", imagen: "/img/9.svg",
    vendedorId: "v2", vendedorUsuarioId: "u102", nombreTienda: "Rueda Libre", publicado: true, eliminado: false },
  { id: "prd-008", nombre: "Bicicleta MTB rin 29", precio: 1850000, categoria: "bicicletas", imagen: "/img/8.svg",
    vendedorId: "v2", vendedorUsuarioId: "u102", nombreTienda: "Rueda Libre", publicado: true, eliminado: false },
  { id: "prd-029", nombre: "Sombrero vueltiao", precio: 420000, categoria: "artesanias", imagen: "/img/29.svg",
    vendedorId: "v5", vendedorUsuarioId: "u105", nombreTienda: "Taller Zenú", publicado: true, eliminado: false },
  { id: "prd-099", nombre: "Oculto", precio: 1000, vendedorId: "v1", publicado: false, eliminado: false },
];

// stock: { productoId: disponible }. Las banderas simulan servicios caídos.
export function clientesFalsos({ stock = { "prd-009": 2, "prd-008": 10, "prd-029": 5 } } = {}) {
  const estado = { productos: PRODUCTOS.map((p) => ({ ...p })), stock, catalogoCaido: false, inventarioCaido: false };
  return {
    estado,
    async productos(ids) {
      if (estado.catalogoCaido) throw new ErrorServicioNoDisponible("Catálogo no disponible, intenta en unos segundos");
      return estado.productos.filter((p) => ids.includes(p.id));
    },
    async disponibilidad(items) {
      if (estado.inventarioCaido) throw new ErrorServicioNoDisponible("Inventario no disponible, intenta en unos segundos");
      return items.map(({ productoId, cantidad }) => {
        const disponible = estado.stock[productoId] ?? 0;
        return { productoId, disponible, solicitado: cantidad, alcanza: disponible >= cantidad,
          estado: disponible === 0 ? "agotado" : disponible <= 3 ? "ultimas_unidades" : "disponible" };
      });
    },
  };
}

export const logger = crearLogger("pruebas");
