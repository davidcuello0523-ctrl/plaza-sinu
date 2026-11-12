import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { CIUDADES, hace } from "../api/formato.js";
import { inicioDeRol, useSesion } from "../estado/sesion.jsx";
import { usePlaza } from "../estado/plaza.jsx";
import Icono from "./Icono.jsx";

function useCerrarFuera(abierto, cerrar) {
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e) => ref.current && !ref.current.contains(e.target) && cerrar();
    const escape = (e) => e.key === "Escape" && cerrar();
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", escape); };
  }, [abierto, cerrar]);
  return ref;
}

function Campana() {
  const { notificaciones, noLeidas, marcarLeidas } = usePlaza();
  const [abierta, setAbierta] = useState(false);
  const ref = useCerrarFuera(abierta, () => setAbierta(false));
  const navegar = useNavigate();
  return (
    <div className="desplegable" ref={ref}>
      <button className="boton boton-plano boton-icono barra-accion" aria-expanded={abierta} aria-haspopup="true"
        onClick={() => setAbierta((v) => !v)} aria-label={`Notificaciones, ${noLeidas} sin leer`}>
        <Icono nombre="campana" />
        {noLeidas > 0 && <span key={noLeidas} className="contador">{noLeidas > 9 ? "9+" : noLeidas}</span>}
      </button>
      {abierta && (
        <div className="menu-flotante menu-notificaciones">
          <div className="fila entre menu-cabeza">
            <strong>Notificaciones</strong>
            {noLeidas > 0 && <button className="boton boton-plano boton-sm" onClick={marcarLeidas}>Marcar todas como leídas</button>}
          </div>
          {notificaciones.length === 0 ? (
            <p className="secundario" style={{ padding: 16 }}>Aquí verás tus pedidos, pagos y avisos de stock en cuanto ocurran.</p>
          ) : (
            <ul className="lista-notificaciones">
              {notificaciones.slice(0, 12).map((n) => (
                <li key={n._id || n.id} className={n.leida ? "" : "no-leida"}>
                  <button onClick={() => { setAbierta(false); if (n.enlace) navegar(n.enlace); }}>
                    <strong>{n.titulo}</strong>
                    <span className="secundario">{n.mensaje}</span>
                    <small className="secundario">{hace(n.creadoEn)}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function MenuCuenta() {
  const { usuario, salir } = useSesion();
  const [abierto, setAbierto] = useState(false);
  const ref = useCerrarFuera(abierto, () => setAbierto(false));
  const navegar = useNavigate();
  const iniciales = usuario.nombre.split(" ").map((p) => p[0]).slice(0, 2).join("");
  const enlaces = {
    cliente: [["/pedidos", "Mis pedidos", "caja"]],
    vendedor: [["/mi-puesto", "Mi puesto", "puesto"], ["/mi-puesto/pedidos", "Pedidos por atender", "caja"]],
    admin: [["/sala", "Sala de máquinas", "mapa"], ["/sala/eventos", "Radar de eventos", "radar"]],
  }[usuario.rol] || [];
  return (
    <div className="desplegable" ref={ref}>
      <button className="cuenta" aria-expanded={abierto} aria-haspopup="true" onClick={() => setAbierto((v) => !v)}>
        <span className="avatar" aria-hidden="true">{iniciales}</span>
        <span className="cuenta-nombre">{usuario.nombre.split(" ")[0]}</span>
      </button>
      {abierto && (
        <div className="menu-flotante menu-cuenta">
          <div className="menu-cabeza">
            <strong>{usuario.nombre}</strong>
            <span className="secundario">{usuario.email}</span>
            <span className="sello sello-plano sello-rio" style={{ marginTop: 8, width: "fit-content" }}>{usuario.rol}</span>
          </div>
          {enlaces.map(([a, texto, icono]) => (
            <Link key={a} to={a} className="menu-item" onClick={() => setAbierto(false)}><Icono nombre={icono} /> {texto}</Link>
          ))}
          <button className="menu-item" onClick={async () => { setAbierto(false); await salir(); navegar("/"); }}>
            <Icono nombre="salir" /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

function BotonTema() {
  const [tema, setTema] = useState(() => document.documentElement.dataset.tema || "claro");
  const oscuro = tema === "oscuro";
  const cambiar = () => {
    const nuevo = oscuro ? "claro" : "oscuro";
    const raiz = document.documentElement;
    raiz.classList.add("cambiando-tema");
    raiz.dataset.tema = nuevo;
    setTimeout(() => raiz.classList.remove("cambiando-tema"), 500);
    try { localStorage.setItem("plaza.tema", nuevo); } catch {}
    setTema(nuevo);
  };
  return (
    <button type="button" className="boton boton-plano boton-icono barra-accion boton-tema" onClick={cambiar}
      aria-pressed={oscuro} aria-label="Modo oscuro" title={oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}>
      <Icono nombre={oscuro ? "sol" : "luna"} />
    </button>
  );
}

export default function BarraSuperior() {
  const { usuario } = useSesion();
  const { carrito, ciudad, elegirCiudad } = usePlaza();
  const [params] = useSearchParams();
  const [texto, setTexto] = useState(params.get("q") || "");
  const navegar = useNavigate();

  const buscar = (e) => {
    e.preventDefault();
    navegar(`/catalogo${texto.trim() ? `?q=${encodeURIComponent(texto.trim())}` : ""}`);
  };

  return (
    <header className="barra">
      <div className="contenedor barra-fila">
        <Link to={usuario ? inicioDeRol(usuario.rol) : "/"} className="logo" aria-label="Plaza Sinú, inicio">
          <svg viewBox="0 0 40 32" width="40" height="32" aria-hidden="true">
            <rect x="1" y="1" width="38" height="9" rx="2" fill="#E4572E" stroke="currentColor" strokeWidth="1.5" />
            <path d="M1 10c0 3 2.2 5 4.7 5s4.6-2 4.6-5c0 3 2.1 5 4.7 5s4.7-2 4.7-5c0 3 2.1 5 4.6 5s4.7-2 4.7-5c0 3 2.1 5 4.7 5S39 13 39 10" fill="#E4572E" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 17v13h30V17" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 30v-7h8v7" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span>Plaza <b>Sinú</b></span>
        </Link>

        <form className="buscador" role="search" onSubmit={buscar}>
          <label htmlFor="buscar" className="solo-lectores">Buscar en la plaza</label>
          <Icono nombre="buscar" />
          <input id="buscar" type="search" value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder="Busca una bici, un sombrero vueltiao, un portátil…" autoComplete="off" />
          <button className="boton boton-primario boton-sm" type="submit">Buscar</button>
        </form>

        <div className="barra-acciones">
          <label className="ciudad">
            <Icono nombre="ubicacion" tamano={18} />
            <span className="solo-lectores">Ciudad</span>
            <select value={ciudad} onChange={(e) => elegirCiudad(e.target.value)}>
              {CIUDADES.map((c) => <option key={c} value={c}>{c === "Todas" ? "Todo Córdoba" : c}</option>)}
            </select>
          </label>

          {usuario?.rol === "cliente" && (
            <NavLink to="/carrito" className="boton boton-plano boton-icono barra-accion" aria-label={`Carrito, ${carrito?.unidades || 0} unidades`}>
              <Icono nombre="carrito" />
              {carrito?.unidades > 0 && <span key={carrito.unidades} className="contador">{carrito.unidades}</span>}
            </NavLink>
          )}
          <BotonTema />
          {usuario && <Campana />}
          {usuario ? <MenuCuenta /> : <Link to="/entrar" className="boton boton-sm">Entrar</Link>}
        </div>
      </div>
    </header>
  );
}
