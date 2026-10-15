// Pruebas UNITARIAS de la lógica de usuarios (sin HTTP ni base de datos).
import { crearServicioUsuarios } from "../src/servicios/usuarios.servicio.js";
import { verificarJwt } from "@plaza/compartido";
import { busFalso, repoEnMemoria } from "./dobles.js";

const datos = { nombre: "Laura", email: "Laura@Correo.co", clave: "Clave1234", rol: "cliente" };

describe("servicio de usuarios", () => {
  let servicio, bus;
  beforeEach(() => {
    bus = busFalso();
    servicio = crearServicioUsuarios({ repo: repoEnMemoria(), bus });
  });

  test("registrar guarda el correo en minúsculas, no expone el hash y publica usuario.registrado", async () => {
    const r = await servicio.registrar(datos);
    expect(r.usuario.email).toBe("laura@correo.co");
    expect(r.usuario.hashClave).toBeUndefined();
    expect(verificarJwt(r.accessToken).rol).toBe("cliente");
    expect(bus.publicados[0].tipo).toBe("usuario.registrado");
  });

  test("no permite dos cuentas con el mismo correo (409)", async () => {
    await servicio.registrar(datos);
    await expect(servicio.registrar(datos)).rejects.toMatchObject({ status: 409, codigo: "EMAIL_EN_USO" });
  });

  test("login con clave incorrecta responde 401 sin revelar si el correo existe", async () => {
    await servicio.registrar(datos);
    await expect(servicio.login({ email: datos.email, clave: "otra" })).rejects.toMatchObject({ status: 401 });
    await expect(servicio.login({ email: "nadie@x.co", clave: "otra" })).rejects.toMatchObject({
      message: "Correo o contraseña incorrectos",
    });
  });

  test("el refresh token es rotativo: sirve una sola vez", async () => {
    const { refreshToken } = await servicio.registrar(datos);
    const nuevo = await servicio.refrescar(refreshToken);
    expect(nuevo.refreshToken).not.toBe(refreshToken);
    await expect(servicio.refrescar(refreshToken)).rejects.toMatchObject({ status: 401 });
    // Reutilizar un token viejo revoca TODAS las sesiones (también el nuevo).
    await expect(servicio.refrescar(nuevo.refreshToken)).rejects.toMatchObject({ status: 401 });
  });
});
