import { useEffect, useRef, useState } from "react";
import { API_URL, abrirStream, api } from "../../api/cliente.js";

export const SERVICIOS = [
  { nombre: "usuarios", puerto: 4001, motor: "PostgreSQL", clave: "postgres", bd: "db-usuarios", resp: "Registro, login, JWT y roles" },
  { nombre: "vendedores", puerto: 4002, motor: "PostgreSQL", clave: "postgres", bd: "db-vendedores", resp: "Solicitud y aprobación de puestos" },
  { nombre: "catalogo", puerto: 4003, motor: "MongoDB", clave: "mongo", bd: "db-catalogo", resp: "Productos, categorías, búsqueda y filtros" },
  { nombre: "carrito", puerto: 4005, motor: "Redis", clave: "redis", bd: "db-carrito", resp: "Carrito por cliente agrupado por vendedor" },
  { nombre: "pedidos-pagos", puerto: 4006, motor: "PostgreSQL", clave: "postgres", bd: "db-pedidos", resp: "Saga de compra, pasarela simulada y traza" },
  { nombre: "inventario", puerto: 4004, motor: "PostgreSQL", clave: "postgres", bd: "db-inventario", resp: "Stock, reservas con vencimiento y kardex" },
  { nombre: "notificaciones", puerto: 4007, motor: "MongoDB", clave: "mongo", bd: "db-notificaciones", resp: "Consume eventos y avisa en vivo (SSE)" },
];

export const IMPACTO = {
  usuarios: "nadie puede iniciar sesión ni registrarse; quien ya tiene sesión sigue comprando hasta que venza su token",
  vendedores: "no se pueden aprobar puestos ni publicar productos nuevos; la compra sigue funcionando",
  catalogo: "no se pueden consultar productos ni agregar al carrito",
  carrito: "no se puede agregar al carrito ni generar pedidos",
  "pedidos-pagos": "no se pueden generar pedidos ni registrar pagos; el catálogo sigue disponible",
  inventario: "el checkout devolverá 503; el resto de la plaza sigue funcionando",
  notificaciones: "los eventos esperan en su cola de RabbitMQ y las notificaciones llegarán al volver",
};

export const URL_SWAGGER = `${API_URL}/docs/`;
export const URL_RABBIT = "http://localhost:15672";

export function useSalud(cadaMs = 3000) {
  const [salud, setSalud] = useState(null);
  const [gatewayCaido, setGatewayCaido] = useState(false);
  useEffect(() => {
    let vivo = true;
    const consultar = async () => {
      try {
        const r = await fetch(`${API_URL}/salud`, { signal: AbortSignal.timeout(2500) });
        const datos = await r.json();
        if (vivo) { setSalud(datos); setGatewayCaido(false); }
      } catch {
        if (vivo) setGatewayCaido(true);
      }
    };
    consultar();
    const id = setInterval(consultar, cadaMs);
    return () => { vivo = false; clearInterval(id); };
  }, [cadaMs]);
  return { salud, gatewayCaido };
}

export function useColas(cadaMs = 3000) {
  const [colas, setColas] = useState([]);
  useEffect(() => {
    let vivo = true;
    const consultar = () => api("/monitor/colas").then((r) => vivo && setColas(r.datos || [])).catch(() => {});
    consultar();
    const id = setInterval(consultar, cadaMs);
    return () => { vivo = false; clearInterval(id); };
  }, [cadaMs]);
  return colas;
}

export function useSucesos(alSuceso, activo = true) {
  const ref = useRef(alSuceso);
  ref.current = alSuceso;
  const [conectado, setConectado] = useState(false);
  useEffect(() => {
    if (!activo) return;
    let fuente;
    let cerrado = false;
    const conectar = () => {
      fuente = abrirStream("/monitor/stream");
      fuente.onopen = () => setConectado(true);
      fuente.onmessage = (e) => {
        try { ref.current(JSON.parse(e.data)); } catch {}
      };
      fuente.onerror = async () => {
        fuente.close();
        setConectado(false);
        if (cerrado) return;
        await api("/usuarios/yo").catch(() => {});
        setTimeout(() => !cerrado && conectar(), 3000);
      };
    };
    conectar();
    return () => { cerrado = true; fuente?.close(); };
  }, [activo]);
  return conectado;
}

export const TEXTO_ESTADO = { ok: "En línea", degradado: "Degradado", caido: "Caído", desconocido: "Sin datos" };
