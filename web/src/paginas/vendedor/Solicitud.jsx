// Solicitud de apertura de puesto (POST /vendedores/solicitudes) y estado de la revisión.
import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../../api/cliente.js";
import { CIUDADES } from "../../api/formato.js";
import { CajaError, Sello } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import { usePlaza } from "../../estado/plaza.jsx";
import { erroresPorCampo, useCarga } from "./utiles.jsx";

const COLORES = ["#E4572E", "#1F6FB2", "#2F8F5B", "#B0457A", "#8A5A2B", "#C98A12", "#3D6B7A", "#6B7A2E"];

export function Campo({ error, etiqueta, ayuda, children }) {
  return (
    <label className={`campo ${error ? "campo-error" : ""}`}>
      <span>{etiqueta}</span>
      {children}
      {error ? <small className="mensaje-error">{error}</small> : ayuda && <small>{ayuda}</small>}
    </label>
  );
}

function VistaPuesto({ nombre, ciudad, categoria, color }) {
  return (
    <div className="vend-vista-puesto" aria-label="Así se verá tu puesto en la plaza">
      <div className="toldo" style={{ "--color-toldo": color }} />
      <div className="vend-vista-cuerpo">
        <span className="vend-sello-tienda" style={{ background: color }}>
          {(nombre || "Tu puesto").split(" ").map((p) => p[0]).slice(0, 2).join("")}
        </span>
        <h3>{nombre || "Nombre de tu puesto"}</h3>
        <p className="secundario">{[categoria, ciudad].filter(Boolean).join(", ") || "Categoría y ciudad"}</p>
      </div>
    </div>
  );
}

function EstadoRevision({ vendedor }) {
  if (vendedor.estado === "APROBADO") {
    return (
      <div className="panel vend-revision">
        <h2>Tu puesto ya está abierto</h2>
        <p className="secundario">Puedes publicar productos y atender pedidos desde las pestañas de Mi Puesto.</p>
        <Link to="/mi-puesto" className="boton boton-primario">Ir al resumen</Link>
      </div>
    );
  }
  const pendiente = vendedor.estado === "PENDIENTE";
  return (
    <div className="vend-solicitud">
      <div className="panel panel-destacado vend-revision">
        <Sello tono={pendiente ? "aviso" : "error"}>
          {pendiente ? "En revisión" : vendedor.estado === "SUSPENDIDO" ? "Suspendido" : "Rechazada"}
        </Sello>
        <h1 className="vend-titulo-solicitud">
          {pendiente ? "Tu solicitud está en revisión" : vendedor.estado === "SUSPENDIDO" ? "Tu puesto está suspendido" : "Tu solicitud no fue aprobada"}
        </h1>
        {pendiente ? (
          <>
            <p>La administración de Plaza Sinú revisa los datos de <strong>{vendedor.nombreTienda}</strong> antes de abrir el puesto.</p>
            <ol className="vend-pasos">
              <li><strong>Revisión.</strong> Verificamos el NIT y los datos de contacto.</li>
              <li><strong>Aprobación.</strong> Te llega una notificación en la campana en cuanto se apruebe.</li>
              <li><strong>Apertura.</strong> Publica tus productos y carga tu stock desde Mi Puesto.</li>
            </ol>
          </>
        ) : (
          <>
            <p>Mientras el puesto no esté aprobado, tus productos no aparecen en la plaza.</p>
            {vendedor.motivoEstado && <p className="caja-aviso">Motivo: {vendedor.motivoEstado}</p>}
            <p className="secundario">Escribe a admin@plazasinu.co para revisar tu caso.</p>
          </>
        )}
      </div>
      <VistaPuesto nombre={vendedor.nombreTienda} ciudad={vendedor.ciudad} categoria={vendedor.categoriaPrincipal} color={vendedor.color} />
    </div>
  );
}

export default function Solicitud(props) {
  const contexto = useOutletContext();
  const vendedor = props.vendedor !== undefined ? props.vendedor : contexto?.vendedor;
  const { avisar } = usePlaza();
  const { datos: categorias } = useCarga(() => api("/categorias").then((r) => r.datos), []);
  const [form, setForm] = useState({
    nombreTienda: "", descripcion: "", categoriaPrincipal: "", ciudad: "Montería", color: COLORES[0], nit: "", telefono: "",
  });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  if (vendedor) return <EstadoRevision vendedor={vendedor} />;

  const campos = erroresPorCampo(error);
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const nombreCategoria = categorias?.find((c) => c.slug === form.categoriaPrincipal)?.nombre;

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const cuerpo = { ...form, nit: form.nit || undefined, telefono: form.telefono || undefined };
      await api("/vendedores/solicitudes", { metodo: "POST", cuerpo });
      avisar("Solicitud enviada. Te avisaremos cuando se apruebe.", "exito");
      (props.alEnviar || contexto?.recargarVendedor)?.();
    } catch (err) {
      setError(err);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="vend-solicitud">
      <form className="panel panel-destacado pila vend-form-solicitud" onSubmit={enviar} noValidate>
        <div>
          <h1 className="vend-titulo-solicitud">Abre tu puesto en Plaza Sinú</h1>
          <p className="secundario">Cuéntanos de tu negocio. Un administrador revisa la solicitud y te avisa por la campana.</p>
        </div>
        {error && !Object.keys(campos).length && <CajaError error={error} />}
        <Campo error={campos.nombreTienda} etiqueta="Nombre del puesto">
          <input className="entrada" value={form.nombreTienda} onChange={cambiar("nombreTienda")} required maxLength={60} />
        </Campo>
        <Campo error={campos.descripcion} etiqueta="Qué vendes" ayuda="Máximo 500 caracteres.">
          <textarea className="entrada" value={form.descripcion} onChange={cambiar("descripcion")} maxLength={500} />
        </Campo>
        <div className="vend-dos-columnas">
          <Campo error={campos.categoriaPrincipal} etiqueta="Categoría principal">
            <select className="selector" value={form.categoriaPrincipal} onChange={cambiar("categoriaPrincipal")} required>
              <option value="">Elige una</option>
              {categorias?.map((c) => <option key={c.slug} value={c.slug}>{c.nombre}</option>)}
            </select>
          </Campo>
          <Campo error={campos.ciudad} etiqueta="Ciudad">
            <select className="selector" value={form.ciudad} onChange={cambiar("ciudad")}>
              {CIUDADES.filter((c) => c !== "Todas").map((c) => <option key={c}>{c}</option>)}
            </select>
          </Campo>
          <Campo error={campos.nit} etiqueta="NIT (opcional)" ayuda="Formato 900123456-7">
            <input className="entrada mono" value={form.nit} onChange={cambiar("nit")} inputMode="numeric" placeholder="900123456-7" />
          </Campo>
          <Campo error={campos.telefono} etiqueta="Teléfono (opcional)">
            <input className="entrada" value={form.telefono} onChange={cambiar("telefono")} type="tel" />
          </Campo>
        </div>
        <fieldset className="vend-colores">
          <legend>Color del toldo</legend>
          <div className="fila">
            {COLORES.map((c) => (
              <label key={c} className="vend-muestra" style={{ background: c }}>
                <input type="radio" name="color" value={c} checked={form.color === c} onChange={cambiar("color")} />
                <span className="solo-lectores">Color {c}</span>
                {form.color === c && <Icono nombre="check" tamano={18} />}
              </label>
            ))}
          </div>
        </fieldset>
        <button className="boton boton-primario" disabled={enviando}>{enviando ? "Enviando…" : "Enviar solicitud"}</button>
      </form>
      <VistaPuesto nombre={form.nombreTienda} ciudad={form.ciudad} categoria={nombreCategoria} color={form.color} />
    </div>
  );
}
