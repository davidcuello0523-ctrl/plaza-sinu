import { crearServicioVendedores, crearSlug, puedeVer } from "../src/servicios/vendedores.servicio.js";
import { busFalso, repoEnMemoria } from "./dobles.js";

const vendedor = { id: "u-vend", rol: "vendedor" };
const solicitud = { nombreTienda: "Hilo & Río", categoriaPrincipal: "ropa", ciudad: "Cereté", descripcion: "" };

describe("servicio de vendedores", () => {
  let servicio, bus;
  beforeEach(() => {
    bus = busFalso();
    servicio = crearServicioVendedores({ repo: repoEnMemoria(), bus });
  });

  test("crearSlug quita tildes y convierte & en y", () => {
    expect(crearSlug("Hilo & Río")).toBe("hilo-y-rio");
    expect(crearSlug("Papelería El Lápiz")).toBe("papeleria-el-lapiz");
  });

  test("la solicitud nace PENDIENTE con NIT simulado; una segunda solicitud → 409", async () => {
    const v = await servicio.solicitar(vendedor, solicitud);
    expect(v.estado).toBe("PENDIENTE");
    expect(v.nit).toMatch(/^\d{9}-\d$/);
    await expect(servicio.solicitar(vendedor, solicitud)).rejects.toMatchObject({ status: 409 });
  });

  test("aprobar publica vendedor.aprobado; suspender publica vendedor.suspendido", async () => {
    const v = await servicio.solicitar(vendedor, solicitud);
    const aprobado = await servicio.cambiarEstado(v.id, { estado: "APROBADO" });
    expect(aprobado.aprobadoEn).toBeInstanceOf(Date);
    await servicio.cambiarEstado(v.id, { estado: "SUSPENDIDO", motivo: "Quejas" });
    expect(bus.publicados.map((e) => e.tipo)).toEqual(["vendedor.aprobado", "vendedor.suspendido"]);
    expect(bus.publicados[0].datos).toMatchObject({ vendedorId: v.id, usuarioId: "u-vend", nombreTienda: "Hilo & Río" });
  });

  test("cambiar al mismo estado no publica nada", async () => {
    const v = await servicio.solicitar(vendedor, solicitud);
    await servicio.cambiarEstado(v.id, { estado: "APROBADO" });
    await servicio.cambiarEstado(v.id, { estado: "APROBADO" });
    expect(bus.publicados).toHaveLength(1);
  });

  test("un puesto pendiente solo lo ven su dueño y el admin", () => {
    const p = { estado: "PENDIENTE", usuarioId: "u1" };
    expect(puedeVer(p, undefined)).toBe(false);
    expect(puedeVer(p, { id: "u1", rol: "vendedor" })).toBe(true);
    expect(puedeVer(p, { id: "x", rol: "admin" })).toBe(true);
  });

  test("el público solo lista aprobados aunque pida ?estado=PENDIENTE", async () => {
    await servicio.solicitar(vendedor, solicitud);
    expect(await servicio.listar({ estado: "PENDIENTE" }, undefined)).toHaveLength(0);
    expect(await servicio.listar({ estado: "PENDIENTE" }, { rol: "admin" })).toHaveLength(1);
  });
});
