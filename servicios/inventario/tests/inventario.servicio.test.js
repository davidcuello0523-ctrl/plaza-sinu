// Pruebas UNITARIAS: reglas puras y ciclo reservar → confirmar / liberar.
import { estadoStock, validarReserva } from "../src/servicios/reglas.js";
import { crearServicioInventario } from "../src/servicios/inventario.servicio.js";
import { stockInicial } from "../src/seed.js";
import { busFalso, repoEnMemoria, stocksDemo } from "./dobles.js";

describe("reglas de stock", () => {
  test("estado según disponible y umbral", () => {
    expect(estadoStock({ fisico: 0, reservado: 0, umbral: 3 })).toBe("agotado");
    expect(estadoStock({ fisico: 5, reservado: 3, umbral: 3 })).toBe("ultimas_unidades");
    expect(estadoStock({ fisico: 10, reservado: 0, umbral: 3 })).toBe("disponible");
  });

  test("validarReserva lanza 409 con el producto que falló y un mensaje claro", () => {
    const stocks = new Map([["prd-009", { productoId: "prd-009", nombreProducto: "Casco MTB", fisico: 2, reservado: 0 }]]);
    expect(() => validarReserva(stocks, [{ productoId: "prd-009", cantidad: 3 }])).toThrow("Solo quedan 2 unidades de Casco MTB");
    try {
      validarReserva(stocks, [{ productoId: "nada", cantidad: 1 }]);
    } catch (e) {
      expect(e).toMatchObject({ status: 409, codigo: "STOCK_INSUFICIENTE" });
      expect(e.detalles[0]).toMatchObject({ productoId: "nada", disponible: 0, solicitado: 1 });
    }
  });

  test("regla de stock inicial del contrato", () => {
    expect([stockInicial(3), stockInicial(9), stockInicial(20), stockInicial(1)]).toEqual([1, 2, 0, 12]);
  });
});

describe("servicio de inventario", () => {
  let repo, bus, servicio;
  beforeEach(() => {
    repo = repoEnMemoria(stocksDemo());
    bus = busFalso();
    servicio = crearServicioInventario({ repo, bus });
  });
  const tipos = () => bus.publicados.map((e) => e.tipo);

  test("reservar aparta unidades sin tocar el físico", async () => {
    const { reserva, nueva } = await servicio.reservar({ pedidoId: "p1", items: [{ productoId: "prd-008", cantidad: 3 }] });
    expect(nueva).toBe(true);
    expect(reserva.estado).toBe("ACTIVA");
    expect(await servicio.obtener("prd-008")).toMatchObject({ fisico: 10, reservado: 3, disponible: 7 });
  });

  test("reservar es todo o nada: si un ítem no alcanza, no se reserva ninguno", async () => {
    await expect(servicio.reservar({ pedidoId: "p1", items: [
      { productoId: "prd-008", cantidad: 1 }, { productoId: "prd-009", cantidad: 5 }] })).rejects.toMatchObject({ status: 409 });
    expect((await servicio.obtener("prd-008")).reservado).toBe(0);
  });

  test("misma reserva dos veces (mismo pedido) no duplica", async () => {
    const a = await servicio.reservar({ pedidoId: "p1", items: [{ productoId: "prd-008", cantidad: 2 }] });
    const b = await servicio.reservar({ pedidoId: "p1", items: [{ productoId: "prd-008", cantidad: 2 }] });
    expect(b.nueva).toBe(false);
    expect(b.reserva.id).toBe(a.reserva.id);
    expect((await servicio.obtener("prd-008")).reservado).toBe(2);
  });

  test("confirmar descuenta definitivo, avisa stock bajo y es idempotente", async () => {
    const { reserva } = await servicio.reservar({ pedidoId: "p1", items: [{ productoId: "prd-009", cantidad: 1 }] });
    await servicio.confirmar(reserva.id);
    await servicio.confirmar(reserva.id); // repetido: sin efecto
    expect(await servicio.obtener("prd-009")).toMatchObject({ fisico: 1, reservado: 0, disponible: 1 });
    expect(tipos()).toEqual(["inventario.actualizado", "inventario.stock_bajo", "reserva.confirmada"]);
  });

  test("liberar devuelve las unidades (compensación) y no se puede confirmar después", async () => {
    const { reserva } = await servicio.reservar({ pedidoId: "p1", items: [{ productoId: "prd-009", cantidad: 2 }] });
    const r = await servicio.liberar(reserva.id, "pago_rechazado");
    expect(r).toMatchObject({ estado: "LIBERADA", motivoLiberacion: "pago_rechazado" });
    expect((await servicio.obtener("prd-009")).disponible).toBe(2);
    expect(tipos()).toContain("reserva.liberada");
    await expect(servicio.confirmar(reserva.id)).rejects.toMatchObject({ status: 409, codigo: "RESERVA_CERRADA" });
  });

  test("las reservas vencidas se liberan solas", async () => {
    await servicio.reservar({ pedidoId: "p1", items: [{ productoId: "prd-008", cantidad: 4 }], minutos: -1 });
    await servicio.liberarVencidas();
    expect((await servicio.obtener("prd-008")).reservado).toBe(0);
  });

  test("producto.publicado crea el stock en 0", async () => {
    await servicio.registrarProducto({ productoId: "nuevo", vendedorUsuarioId: "v", nombreProducto: "Nuevo" });
    expect(await servicio.obtener("nuevo")).toMatchObject({ fisico: 0, estado: "agotado" });
  });
});
