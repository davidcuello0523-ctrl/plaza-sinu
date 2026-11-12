import { armarCarrito, formatoCOP } from "../src/servicios/armado.js";
import { PRODUCTOS } from "./dobles.js";

const disp = (pares) => Object.entries(pares).map(([productoId, disponible]) => ({
  productoId, disponible, estado: disponible === 0 ? "agotado" : "disponible" }));

describe("armarCarrito", () => {
  test("formato COP", () => {
    expect(formatoCOP(1250000)).toBe("$ 1.250.000");
  });

  test("agrupa por vendedor con subtotales por puesto y total general", () => {
    const c = armarCarrito({
      items: [
        { productoId: "prd-009", cantidad: 2, precioAlAgregar: 159000 },
        { productoId: "prd-029", cantidad: 1, precioAlAgregar: 420000 },
        { productoId: "prd-008", cantidad: 1, precioAlAgregar: 1850000 },
      ],
      productos: PRODUCTOS,
      disponibilidad: disp({ "prd-009": 5, "prd-029": 5, "prd-008": 5 }),
    });
    expect(c.grupos).toHaveLength(2);
    const rueda = c.grupos.find((g) => g.vendedorId === "v2");
    expect(rueda.subtotal).toBe(2 * 159000 + 1850000);
    expect(rueda.unidades).toBe(3);
    expect(c.total).toBe(2 * 159000 + 1850000 + 420000);
    expect(c.unidades).toBe(4);
    expect(c.valido).toBe(true);
    expect(c.avisos).toEqual([]);
  });

  test("avisa cambio de precio y usa el precio actual", () => {
    const c = armarCarrito({
      items: [{ productoId: "prd-009", cantidad: 1, precioAlAgregar: 149000 }],
      productos: PRODUCTOS,
      disponibilidad: disp({ "prd-009": 5 }),
    });
    expect(c.avisos[0]).toBe("El precio de Casco MTB ventilado cambió de $ 149.000 a $ 159.000");
    expect(c.total).toBe(159000);
    expect(c.valido).toBe(true);
  });

  test("poco stock, agotado y producto despublicado invalidan el carrito", () => {
    const c = armarCarrito({
      items: [
        { productoId: "prd-009", cantidad: 3, precioAlAgregar: 159000 },
        { productoId: "prd-029", cantidad: 1, precioAlAgregar: 420000 },
        { productoId: "prd-099", cantidad: 1, precioAlAgregar: 1000 },
      ],
      productos: PRODUCTOS,
      disponibilidad: disp({ "prd-009": 2, "prd-029": 0, "prd-099": 9 }),
    });
    expect(c.valido).toBe(false);
    expect(c.avisos).toEqual(expect.arrayContaining([
      "Solo quedan 2 unidades de Casco MTB ventilado",
      "Sombrero vueltiao está agotado",
      "Oculto ya no está disponible",
    ]));
  });

  test("sin inventario (null) el carrito se muestra pero queda no válido", () => {
    const c = armarCarrito({
      items: [{ productoId: "prd-009", cantidad: 1, precioAlAgregar: 159000 }],
      productos: PRODUCTOS,
      disponibilidad: null,
    });
    expect(c.grupos[0].items[0].estadoStock).toBe("desconocido");
    expect(c.avisos).toContain("No pudimos verificar el stock en este momento");
    expect(c.valido).toBe(false);
  });

  test("carrito vacío es válido con total 0", () => {
    const c = armarCarrito({ items: [], productos: [], disponibilidad: [] });
    expect(c).toMatchObject({ grupos: [], total: 0, unidades: 0, valido: true });
  });
});
