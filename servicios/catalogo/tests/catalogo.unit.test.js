import { construirConsulta } from "../src/repositorio/productos.repositorio.js";
import { estadoDeStock } from "../src/categorias.js";
import { crearManejadorEventos } from "../src/eventos/consumidores.js";
import { generarImagen } from "../src/servicios/imagen.js";
import { productosDemo, stockInicial } from "../src/seed.js";
import { producto, repoEnMemoria } from "./dobles.js";

describe("construirConsulta (filtros → MongoDB)", () => {
  test("el público solo ve publicados, no eliminados y de puestos activos", () => {
    const { consulta } = construirConsulta({});
    expect(consulta).toEqual({ eliminado: false, publicado: true, vendedorActivo: true });
  });

  test("filtros de precio, categoría, disponibilidad y orden", () => {
    const { consulta, orden } = construirConsulta({ categoria: "bicicletas", precioMin: 100000, precioMax: 500000, soloDisponibles: true, orden: "precio_asc" });
    expect(consulta.precio).toEqual({ $gte: 100000, $lte: 500000 });
    expect(consulta.estadoStock).toEqual({ $ne: "agotado" });
    expect(orden).toEqual({ precio: 1, _id: 1 });
  });

  test("la búsqueda ignora tildes y escapa caracteres especiales", () => {
    const { consulta } = construirConsulta({ q: "monteria (" });
    const patron = consulta.$or[0].nombre;
    expect(patron.test("Montería ( centro")).toBe(true);
  });

  test("?mios: el vendedor ve también sus ocultos", () => {
    const { consulta } = construirConsulta({ duenoUsuarioId: "u1" });
    expect(consulta).toEqual({ eliminado: false, vendedorUsuarioId: "u1" });
  });
});

describe("regla de stock y seed", () => {
  test("agotado / últimas unidades / disponible con umbral 3", () => {
    expect(estadoDeStock(0)).toBe("agotado");
    expect(estadoDeStock(2)).toBe("ultimas_unidades");
    expect(estadoDeStock(3)).toBe("ultimas_unidades");
    expect(estadoDeStock(4)).toBe("disponible");
  });

  test("el seed tiene 48 productos con los casos especiales del contrato", () => {
    const ps = productosDemo();
    expect(ps).toHaveLength(48);
    const porId = Object.fromEntries(ps.map((p) => [p._id, p]));
    expect(porId["prd-009"]).toMatchObject({ nombre: "Casco MTB ventilado", precio: 159000, stockDisponible: 2, estadoStock: "ultimas_unidades" });
    expect(porId["prd-020"].estadoStock).toBe("agotado");
    expect(porId["prd-029"].vendedorId).toBe("00000000-0000-4000-c000-000000000005");
    expect(porId["prd-048"].nombreTienda).toBe("Deportes Ribera");
    expect(stockInicial(1)).toBe(12);
  });
});

describe("consumidores de eventos", () => {
  test("inventario.actualizado copia el estado de stock", async () => {
    const repo = repoEnMemoria([producto()]);
    await crearManejadorEventos(repo)({ tipo: "inventario.actualizado", datos: { productoId: "prd-009", estado: "agotado", disponible: 0 } });
    expect(repo.datos.get("prd-009")).toMatchObject({ estadoStock: "agotado", stockDisponible: 0 });
  });

  test("vendedor.suspendido oculta sus productos y vendedor.aprobado los vuelve a mostrar", async () => {
    const repo = repoEnMemoria([producto()]);
    const manejar = crearManejadorEventos(repo);
    await manejar({ tipo: "vendedor.suspendido", datos: { vendedorId: "v2" } });
    expect(repo.datos.get("prd-009").vendedorActivo).toBe(false);
    await manejar({ tipo: "vendedor.aprobado", datos: { vendedorId: "v2" } });
    expect(repo.datos.get("prd-009").vendedorActivo).toBe(true);
  });
});

describe("imagen SVG", () => {
  test("es estable por id y usa un color seguro", () => {
    const a = generarImagen({ id: "prd-001", categoria: "tecnologia", colorTienda: "#1F6FB2" });
    expect(a).toBe(generarImagen({ id: "prd-001", categoria: "tecnologia", colorTienda: "#1F6FB2" }));
    expect(a).toContain("#1F6FB2");
    const malicioso = generarImagen({ id: "x", categoria: "ropa", colorTienda: '"/><script>' });
    expect(malicioso).not.toContain("<script>");
  });
});
