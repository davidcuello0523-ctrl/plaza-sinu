// Entrar / Crear cuenta: pantalla dividida. A la izquierda, un collage de
// puestos con su toldo; a la derecha, el formulario.
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { urlRecurso } from "../../api/cliente.js";
import { CIUDADES } from "../../api/formato.js";
import Icono from "../../componentes/Icono.jsx";
import { inicioDeRol, useSesion } from "../../estado/sesion.jsx";
import "../../estilos/compra.css";

const PUESTOS = [
  { tienda: "Tecno Sinú", ciudad: "Montería", color: "#1F6FB2", producto: "prd-001" },
  { tienda: "Rueda Libre", ciudad: "Montería", color: "#2F8F5B", producto: "prd-008" },
  { tienda: "Hilo & Río", ciudad: "Cereté", color: "#B0457A", producto: "prd-015" },
  { tienda: "Taller Zenú", ciudad: "Sahagún", color: "#C98A12", producto: "prd-029" },
  { tienda: "Casa Ronda", ciudad: "Montería", color: "#8A5A2B", producto: "prd-022" },
  { tienda: "Papelería El Lápiz", ciudad: "Lorica", color: "#3D6B7A", producto: "prd-036" },
];

const DEMO = [
  { rol: "Cliente", email: "cliente@plazasinu.co" },
  { rol: "Vendedor", email: "bicis@plazasinu.co" },
  { rol: "Admin", email: "admin@plazasinu.co" },
];

export default function Entrar({ modo }) {
  const registro = modo === "registro";
  const { entrar, registrar } = useSesion();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const [datos, setDatos] = useState({ nombre: "", email: "", clave: "", rol: "cliente", ciudad: "Montería" });
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [errores, setErrores] = useState({});

  const cambiar = (campo) => (e) => setDatos((d) => ({ ...d, [campo]: e.target.value }));

  async function enviar(e) {
    e.preventDefault();
    setEnviando(true); setError(null); setErrores({});
    try {
      const usuario = registro ? await registrar(datos) : await entrar(datos.email, datos.clave);
      navegar(ubicacion.state?.desde || inicioDeRol(usuario.rol), { replace: true });
    } catch (err) {
      setError(err.status === 429 ? "Demasiados intentos. Espera un minuto y vuelve a probar." : err.message);
      setErrores(Object.fromEntries((err.detalles || []).map((d) => [d.campo, d.mensaje])));
    } finally {
      setEnviando(false);
    }
  }

  const campo = (nombre, etiqueta, props = {}) => (
    <label className={`campo ${errores[nombre] ? "campo-error" : ""}`}>
      <span>{etiqueta}</span>
      <input className="entrada" value={datos[nombre]} onChange={cambiar(nombre)} aria-invalid={Boolean(errores[nombre])} {...props} />
      {errores[nombre] && <small className="mensaje-error">{errores[nombre]}</small>}
    </label>
  );

  return (
    <div className="entrar">
      <aside className="entrar-collage">
        <Link to="/" className="entrar-logo">Plaza <b>Sinú</b></Link>
        <div className="collage" aria-hidden="true">
          {PUESTOS.map((p) => (
            <div key={p.tienda} className="collage-puesto">
              <div className="toldo toldo-mini" style={{ "--color-toldo": p.color }} />
              <img src={urlRecurso(`/productos/${p.producto}/imagen.svg`)} alt="" loading="lazy" />
              <div className="collage-pie">
                <strong>{p.tienda}</strong>
                <span>{p.ciudad}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="collage-texto">
          Las tiendas de Montería, Cereté, Lorica y Sahagún abren su puesto aquí. Tú compras a varias en un solo carrito.
        </p>
      </aside>

      <section className="entrar-formulario">
        <Link to="/" className="boton boton-plano boton-sm volver"><Icono nombre="atras" tamano={18} /> Volver a la plaza</Link>
        <div className="entrar-caja pila">
          <div>
            <h1>{registro ? "Crea tu cuenta" : "Entra a la plaza"}</h1>
            <p className="secundario" style={{ marginTop: 8 }}>
              {registro ? "Compra en los puestos de Córdoba o abre el tuyo." : "Sigue tus pedidos, atiende tu puesto o revisa la sala de máquinas."}
            </p>
          </div>

          {error && <div className="caja-error" role="alert">{error}</div>}

          <form className="pila" onSubmit={enviar} noValidate>
            {registro && campo("nombre", "Nombre completo", { autoComplete: "name", required: true })}
            {campo("email", "Correo", { type: "email", autoComplete: "email", required: true })}
            <label className={`campo ${errores.clave ? "campo-error" : ""}`}>
              <span>Contraseña</span>
              <div className="clave">
                <input className="entrada" type={verClave ? "text" : "password"} value={datos.clave} onChange={cambiar("clave")}
                  autoComplete={registro ? "new-password" : "current-password"} required aria-invalid={Boolean(errores.clave)} />
                <button type="button" className="boton boton-plano boton-icono" onClick={() => setVerClave((v) => !v)}
                  aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}>
                  <Icono nombre={verClave ? "ojo-tachado" : "ojo"} />
                </button>
              </div>
              {registro && !errores.clave && <small>Mínimo 8 caracteres y al menos un número.</small>}
              {errores.clave && <small className="mensaje-error">{errores.clave}</small>}
            </label>

            {registro && (
              <>
                <fieldset className="segmentado">
                  <legend>Quiero</legend>
                  {[["cliente", "Comprar"], ["vendedor", "Vender en mi puesto"]].map(([valor, texto]) => (
                    <label key={valor} className={datos.rol === valor ? "activo" : ""}>
                      <input type="radio" name="rol" value={valor} checked={datos.rol === valor} onChange={cambiar("rol")} />
                      {texto}
                    </label>
                  ))}
                </fieldset>
                <label className="campo">
                  <span>Ciudad</span>
                  <select className="selector" value={datos.ciudad} onChange={cambiar("ciudad")}>
                    {CIUDADES.filter((c) => c !== "Todas").map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
              </>
            )}

            <button className="boton boton-primario boton-ancho" disabled={enviando}>
              {enviando ? "Un momento…" : registro ? "Crear cuenta" : "Entrar"}
            </button>
          </form>

          <p>
            {registro ? "¿Ya tienes cuenta? " : "¿Primera vez en la plaza? "}
            <Link to={registro ? "/entrar" : "/registro"} state={ubicacion.state} className="enlace">
              {registro ? "Entra" : "Crea tu cuenta"}
            </Link>
          </p>

          {!registro && (
            <div className="demo-credenciales">
              <strong>Cuentas de demostración</strong>
              <p className="secundario">Toca una para llenar el formulario. Clave: <span className="mono">Demo123*</span></p>
              <div className="fila">
                {DEMO.map((d) => (
                  <button key={d.rol} type="button" className="boton boton-sm"
                    onClick={() => setDatos((x) => ({ ...x, email: d.email, clave: "Demo123*" }))}>
                    {d.rol}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
