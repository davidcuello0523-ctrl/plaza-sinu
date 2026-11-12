import {
  calcularTotales, luhnValido, procesarPago, tarjetaVencida, validarTransicionPedido, validarTransicionSubpedido,
} from "../src/servicios/dominio.js";

describe("calcularTotales", () => {
  test("agrupa por vendedor con subtotales, total y unidades", () => {
    const r = calcularTotales([
      { productoId: "a", nombre: "A", precioUnitario: 100000, cantidad: 2, vendedorId: "v1", vendedorUsuarioId: "u1", nombreTienda: "T1" },
      { productoId: "b", nombre: "B", precioUnitario: 50000, cantidad: 1, vendedorId: "v2", vendedorUsuarioId: "u2", nombreTienda: "T2" },
      { productoId: "c", nombre: "C", precioUnitario: 30000, cantidad: 3, vendedorId: "v1", vendedorUsuarioId: "u1", nombreTienda: "T1" },
    ]);
    expect(r.subpedidos).toHaveLength(2);
    expect(r.subpedidos.find((s) => s.vendedorId === "v1")).toMatchObject({ subtotal: 290000, unidades: 5 });
    expect(r.subpedidos.find((s) => s.vendedorId === "v2").items[0].subtotal).toBe(50000);
    expect(r.total).toBe(340000);
    expect(r.unidades).toBe(6);
  });
});

describe("máquina de estados", () => {
  test("el sub-pedido avanza PAGADO → PREPARANDO → ENVIADO → ENTREGADO", () => {
    expect(() => validarTransicionSubpedido("PAGADO", "PREPARANDO")).not.toThrow();
    expect(() => validarTransicionSubpedido("PREPARANDO", "ENVIADO")).not.toThrow();
    expect(() => validarTransicionSubpedido("ENVIADO", "ENTREGADO")).not.toThrow();
  });
  test("no se puede retroceder ni saltar pasos (409 TRANSICION_INVALIDA)", () => {
    expect(() => validarTransicionSubpedido("ENVIADO", "PREPARANDO")).toThrow("No se puede pasar de ENVIADO a PREPARANDO");
    expect(() => validarTransicionSubpedido("PAGADO", "ENTREGADO")).toThrow(expect.objectContaining({ status: 409, codigo: "TRANSICION_INVALIDA" }));
  });
  test("pedido: solo se cancela si está pendiente de pago", () => {
    expect(() => validarTransicionPedido("PENDIENTE_PAGO", "CANCELADO")).not.toThrow();
    expect(() => validarTransicionPedido("PAGADO", "CANCELADO")).toThrow();
  });
});

describe("pasarela simulada", () => {
  test("Luhn valida las tarjetas de prueba y rechaza un dígito alterado", () => {
    expect(luhnValido("4242424242424242")).toBe(true);
    expect(luhnValido("4000000000000002")).toBe(true);
    expect(luhnValido("4242424242424241")).toBe(false);
  });
  test("4242… aprueba y solo devuelve marca y últimos 4", () => {
    const r = procesarPago({ numeroTarjeta: "4242 4242 4242 4242", vencimiento: "12/30" });
    expect(r).toMatchObject({ estado: "APROBADO", marca: "Visa", ultimos4: "4242" });
    expect(JSON.stringify(r)).not.toContain("424242424242");
  });
  test("4000…0002 rechaza por fondos insuficientes", () => {
    expect(procesarPago({ numeroTarjeta: "4000000000000002", vencimiento: "12/30" })).toMatchObject({ estado: "RECHAZADO", motivo: "Fondos insuficientes" });
  });
  test("otra tarjeta válida → 422 indicando las tarjetas de prueba", () => {
    expect(() => procesarPago({ numeroTarjeta: "5555555555554444", vencimiento: "12/30" }))
      .toThrow(expect.objectContaining({ status: 422, message: expect.stringContaining("4242 4242 4242 4242") }));
  });
  test("número que no pasa Luhn → 422", () => {
    expect(() => procesarPago({ numeroTarjeta: "4242424242424241", vencimiento: "12/30" })).toThrow(expect.objectContaining({ status: 422 }));
  });
  test("tarjeta vencida", () => {
    expect(tarjetaVencida("01/20", new Date("2026-10-15"))).toBe(true);
    expect(tarjetaVencida("10/26", new Date("2026-10-15"))).toBe(false);
    expect(() => procesarPago({ numeroTarjeta: "4242424242424242", vencimiento: "01/20" })).toThrow(expect.objectContaining({ status: 422 }));
  });
});
