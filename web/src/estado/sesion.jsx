// Sesión del usuario (JWT + refresh) disponible en toda la app con useSesion().
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, sesionGuardada } from "../api/cliente.js";

const Contexto = createContext(null);

export function ProveedorSesion({ children }) {
  const [sesion, setSesion] = useState(() => sesionGuardada.leer());

  // Se sincroniza cuando el cliente API renueva o borra la sesión (y entre pestañas).
  useEffect(() => {
    const actualizar = () => setSesion(sesionGuardada.leer());
    window.addEventListener("plaza:sesion", actualizar);
    window.addEventListener("storage", actualizar);
    return () => {
      window.removeEventListener("plaza:sesion", actualizar);
      window.removeEventListener("storage", actualizar);
    };
  }, []);

  const entrar = useCallback(async (email, clave) => {
    const nueva = await api("/auth/login", { metodo: "POST", cuerpo: { email, clave } });
    sesionGuardada.guardar(nueva);
    return nueva.usuario;
  }, []);

  const registrar = useCallback(async (datos) => {
    const nueva = await api("/auth/registro", { metodo: "POST", cuerpo: datos });
    sesionGuardada.guardar(nueva);
    return nueva.usuario;
  }, []);

  const salir = useCallback(async () => {
    const actual = sesionGuardada.leer();
    sesionGuardada.borrar();
    if (actual?.refreshToken) {
      await api("/auth/logout", { metodo: "POST", cuerpo: { refreshToken: actual.refreshToken } }).catch(() => {});
    }
  }, []);

  const valor = { usuario: sesion?.usuario || null, rol: sesion?.usuario?.rol || null, entrar, registrar, salir };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const useSesion = () => useContext(Contexto);

// Página de inicio según el rol.
export const inicioDeRol = (rol) => (rol === "vendedor" ? "/mi-puesto" : rol === "admin" ? "/sala" : "/");
