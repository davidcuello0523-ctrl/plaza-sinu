// Piezas pequeñas reutilizadas por todas las zonas.
import { NavLink, Navigate, useLocation } from "react-router-dom";
import { ESTADOS_PEDIDO, ESTADOS_STOCK } from "../api/formato.js";
import { useSesion } from "../estado/sesion.jsx";
import { usePlaza } from "../estado/plaza.jsx";
import Icono from "./Icono.jsx";

// Sello de estado: <Sello estado="PAGADO" /> o <Sello tono="aviso">Texto</Sello>
export function Sello({ estado, stock, tono, children, plano = false }) {
  const def = (estado && ESTADOS_PEDIDO[estado]) || (stock && ESTADOS_STOCK[stock]) || {};
  return (
    <span className={`sello sello-${tono || def.tono || "neutro"} ${plano ? "sello-plano" : ""}`}>
      {children || def.texto || estado || stock}
    </span>
  );
}

export function ChipServicio({ servicio }) {
  return <span className="chip-servicio" data-servicio={servicio}>{servicio}</span>;
}

export function Cargando({ alto = 120, filas = 1 }) {
  return (
    <div className="pila" aria-busy="true" aria-live="polite">
      <span className="solo-lectores">Cargando…</span>
      {Array.from({ length: filas }, (_, i) => <div key={i} className="esqueleto" style={{ height: alto }} />)}
    </div>
  );
}

export function Vacio({ icono = "caja", titulo, children, accion, principal = false }) {
  return (
    <div className="vacio">
      <Icono nombre={icono} tamano={40} />
      {principal ? <h1 className="vacio-titulo">{titulo}</h1> : <h3 className="vacio-titulo">{titulo}</h3>}
      {children && <p>{children}</p>}
      {accion}
    </div>
  );
}

// Muestra un ErrorApi con su mensaje y el correlationId para buscar en los logs.
export function CajaError({ error, alReintentar }) {
  if (!error) return null;
  return (
    <div className="caja-error" role="alert">
      <div className="fila entre">
        <strong>{error.message}</strong>
        {alReintentar && <button className="boton boton-sm" onClick={alReintentar}>Reintentar</button>}
      </div>
      {error.detalles?.length > 0 && (
        <ul>{error.detalles.map((d, i) => <li key={i}>{d.mensaje || JSON.stringify(d)}{d.campo ? ` (${d.campo})` : ""}</li>)}</ul>
      )}
      {error.correlationId && <p className="mono">correlationId {error.correlationId}</p>}
    </div>
  );
}

// Protege una ruta por sesión y, opcionalmente, por rol.
export function RutaProtegida({ roles, children }) {
  const { usuario } = useSesion();
  const ubicacion = useLocation();
  if (!usuario) return <Navigate to="/entrar" replace state={{ desde: ubicacion.pathname }} />;
  if (roles && !roles.includes(usuario.rol)) {
    return (
      <div className="contenedor pagina">
        <Vacio icono="alerta" titulo="Esta zona no es para tu tipo de cuenta" principal>
          Entraste como {usuario.rol}. Cambia de cuenta para ver esta sección.
        </Vacio>
      </div>
    );
  }
  return children;
}

// Encabezado de las zonas Vendedor y Admin con pestañas horizontales.
export function CabeceraZona({ titulo, subtitulo, pestanas, oscura = false, extra }) {
  return (
    <header className={`zona-cabecera ${oscura ? "zona-rio" : ""}`}>
      <div className="contenedor">
        <div className="fila entre">
          <div>
            <h1 style={{ fontSize: "clamp(1.7rem, 3vw, 2.4rem)" }}>{titulo}</h1>
            {subtitulo && <p className="secundario" style={{ marginTop: 6 }}>{subtitulo}</p>}
          </div>
          {extra}
        </div>
        <nav className="pestanas" aria-label={`Secciones de ${titulo}`}>
          {pestanas.map((p) => (
            <NavLink key={p.a} to={p.a} end={p.exacto} className="pestana">
              <Icono nombre={p.icono} tamano={18} /> {p.texto}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

export function Avisos() {
  const { avisos } = usePlaza();
  return (
    <div className="avisos" role="status" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className={`aviso aviso-${a.tono}`}>
          <Icono nombre={a.tono === "error" ? "alerta" : "campana"} />
          <span>{a.texto}</span>
        </div>
      ))}
    </div>
  );
}
