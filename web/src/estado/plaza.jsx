import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { abrirStream, api } from "../api/cliente.js";
import { useSesion } from "./sesion.jsx";

const Contexto = createContext(null);

export function ProveedorPlaza({ children }) {
  const { usuario } = useSesion();
  const [carrito, setCarrito] = useState(null);
  const [ciudad, setCiudad] = useState(() => {
    try { return localStorage.getItem("plaza.ciudad") || "Todas"; } catch { return "Todas"; }
  });
  const [notificaciones, setNotificaciones] = useState([]);
  const [noLeidas, setNoLeidas] = useState(0);
  const [avisos, setAvisos] = useState([]);
  const oyentes = useRef(new Set());

  const avisar = useCallback((texto, tono = "neutro") => {
    const id = crypto.randomUUID();
    setAvisos((a) => [...a, { id, texto, tono }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 5000);
  }, []);

  const elegirCiudad = (c) => {
    setCiudad(c);
    try { localStorage.setItem("plaza.ciudad", c); } catch {}
  };

  const recargarCarrito = useCallback(async () => {
    if (usuario?.rol !== "cliente") return setCarrito(null);
    try { setCarrito(await api("/carrito")); } catch {}
  }, [usuario?.rol]);

  const recargarNotificaciones = useCallback(async () => {
    if (!usuario) return;
    try {
      const r = await api("/notificaciones?porPagina=20");
      setNotificaciones(r.datos || []);
      setNoLeidas(r.noLeidas ?? (r.datos || []).filter((n) => !n.leida).length);
    } catch {}
  }, [usuario]);

  useEffect(() => { recargarCarrito(); }, [recargarCarrito]);

  useEffect(() => {
    if (!usuario) { setNotificaciones([]); setNoLeidas(0); return; }
    recargarNotificaciones();
    let fuente;
    let cerrado = false;
    const conectar = () => {
      fuente = abrirStream("/notificaciones/stream");
      fuente.addEventListener("notificacion", (e) => {
        const n = JSON.parse(e.data);
        setNotificaciones((lista) => [n, ...lista].slice(0, 30));
        setNoLeidas((x) => x + 1);
        avisar(n.titulo, n.tipo === "pago" && /rechaz/i.test(n.titulo) ? "error" : "exito");
        for (const fn of oyentes.current) fn(n);
        if (n.tipo === "pago") recargarCarrito();
      });
      fuente.onerror = async () => {
        fuente.close();
        if (cerrado) return;
        await api("/usuarios/yo").catch(() => {});
        setTimeout(() => !cerrado && conectar(), 3000);
      };
    };
    conectar();
    return () => { cerrado = true; fuente?.close(); };
  }, [usuario, recargarNotificaciones, recargarCarrito, avisar]);

  const marcarLeidas = useCallback(async () => {
    await api("/notificaciones/leer-todas", { metodo: "PATCH" }).catch(() => {});
    setNoLeidas(0);
    setNotificaciones((l) => l.map((n) => ({ ...n, leida: true })));
  }, []);

  const alNotificar = useCallback((fn) => {
    oyentes.current.add(fn);
    return () => oyentes.current.delete(fn);
  }, []);

  const valor = {
    carrito, setCarrito, recargarCarrito,
    ciudad, elegirCiudad,
    notificaciones, noLeidas, marcarLeidas, recargarNotificaciones, alNotificar,
    avisos, avisar,
  };
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export const usePlaza = () => useContext(Contexto);
