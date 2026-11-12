import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CIUDADES } from "../../api/formato.js";
import Icono from "../../componentes/Icono.jsx";
import { inicioDeRol, useSesion } from "../../estado/sesion.jsx";

const PASOS = ["Tu cuenta", "Tus datos", "Dónde estás"];
const CAMPOS_PASO = [
  ["rol", "email", "clave", "confirmar"],
  ["nombres", "apellidos", "nombre", "tipoDocumento", "numeroDocumento", "fechaNacimiento", "telefono"],
  ["ciudad", "direccion", "aceptaTerminos"],
];
const DOCUMENTOS = [["CC", "Cédula de ciudadanía"], ["CE", "Cédula de extranjería"], ["PP", "Pasaporte"]];
const ROLES = [
  { valor: "cliente", icono: "carrito", titulo: "Quiero comprar", texto: "Compra en varios puestos con un solo carrito." },
  { valor: "vendedor", icono: "puesto", titulo: "Quiero vender", texto: "Abre tu puesto y publica tus productos." },
];

const hoy = new Date();
const MAX_NACIMIENTO = new Date(hoy.getFullYear() - 18, hoy.getMonth(), hoy.getDate()).toISOString().slice(0, 10);

function fuerzaClave(clave) {
  return [clave.length >= 8, /\d/.test(clave), /[A-ZÁÉÍÓÚÑ]/.test(clave) && /[a-záéíóúñ]/.test(clave), /[^A-Za-z0-9]/.test(clave) || clave.length >= 12]
    .filter(Boolean).length;
}

function validarPaso(paso, d) {
  const e = {};
  if (paso === 0) {
    if (!/^\S+@\S+\.\S+$/.test(d.email)) e.email = "Escribe un correo válido";
    if (d.clave.length < 8) e.clave = "Mínimo 8 caracteres";
    else if (!/\d/.test(d.clave)) e.clave = "Incluye al menos un número";
    if (d.confirmar !== d.clave) e.confirmar = "Las contraseñas no coinciden";
  }
  if (paso === 1) {
    if (d.nombres.trim().length < 2) e.nombres = "Escribe tu nombre";
    if (d.apellidos.trim().length < 2) e.apellidos = "Escribe tus apellidos";
    if (!/^[0-9A-Za-z]{5,15}$/.test(d.numeroDocumento)) e.numeroDocumento = "Entre 5 y 15 letras o números";
    if (!d.fechaNacimiento) e.fechaNacimiento = "Elige tu fecha de nacimiento";
    else if (d.fechaNacimiento > MAX_NACIMIENTO) e.fechaNacimiento = "Debes ser mayor de edad";
    if (!/^3\d{9}$/.test(d.telefono)) e.telefono = "Celular de 10 dígitos que empiece por 3";
  }
  if (paso === 2) {
    if (d.direccion.trim().length < 5) e.direccion = "Escribe tu dirección";
    if (!d.aceptaTerminos) e.aceptaTerminos = "Debes aceptar los términos para continuar";
  }
  return e;
}

export default function FormularioRegistro({ desde }) {
  const { registrar } = useSesion();
  const navegar = useNavigate();
  const [paso, setPaso] = useState(0);
  const [d, setD] = useState({
    rol: "cliente", email: "", clave: "", confirmar: "", nombres: "", apellidos: "", tipoDocumento: "CC",
    numeroDocumento: "", fechaNacimiento: "", telefono: "", ciudad: "Montería", direccion: "", aceptaTerminos: false,
  });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const poner = (campo, valor) => { setD((x) => ({ ...x, [campo]: valor })); setErrores((x) => ({ ...x, [campo]: undefined })); };
  const cambiar = (campo) => (e) => poner(campo, e.target.type === "checkbox" ? e.target.checked : e.target.value);

  function continuar(e) {
    e.preventDefault();
    const e2 = validarPaso(paso, d);
    setErrores(e2);
    if (Object.keys(e2).length) return;
    if (paso < 2) { setPaso(paso + 1); return; }
    crear();
  }

  async function crear() {
    setEnviando(true); setError(null);
    try {
      const usuario = await registrar({
        nombre: `${d.nombres.trim()} ${d.apellidos.trim()}`, email: d.email.trim(), clave: d.clave, rol: d.rol,
        ciudad: d.ciudad, telefono: d.telefono, tipoDocumento: d.tipoDocumento, numeroDocumento: d.numeroDocumento,
        fechaNacimiento: d.fechaNacimiento, direccion: d.direccion.trim(), aceptaTerminos: true,
      });
      navegar(desde || inicioDeRol(usuario.rol), { replace: true });
    } catch (err) {
      const porCampo = Object.fromEntries((err.detalles || []).map((x) => [x.campo === "nombre" ? "nombres" : x.campo, x.mensaje]));
      if (err.status === 409) porCampo.email = err.message;
      setErrores(porCampo);
      const primero = CAMPOS_PASO.findIndex((campos) => campos.some((c) => porCampo[c]));
      if (primero >= 0) setPaso(primero);
      setError(err.status === 429 ? "Demasiados intentos. Espera un minuto y vuelve a probar." : err.message);
    } finally {
      setEnviando(false);
    }
  }

  const campo = (nombre, etiqueta, props = {}, ayuda) => (
    <label className={`campo ${errores[nombre] ? "campo-error" : ""}`}>
      <span>{etiqueta}</span>
      <input className="entrada" value={d[nombre]} onChange={cambiar(nombre)} aria-invalid={Boolean(errores[nombre])} {...props} />
      {errores[nombre] ? <small className="mensaje-error">{errores[nombre]}</small> : ayuda && <small>{ayuda}</small>}
    </label>
  );

  const fuerza = fuerzaClave(d.clave);
  const textoFuerza = ["Muy débil", "Débil", "Aceptable", "Buena", "Excelente"][fuerza];

  return (
    <form className="reg pila" onSubmit={continuar} noValidate>
      <ol className="reg-pasos" aria-label="Pasos del registro">
        {PASOS.map((t, i) => (
          <li key={t} className={i < paso ? "hecho" : i === paso ? "actual" : ""} aria-current={i === paso ? "step" : undefined}>
            <span className="reg-numero">{i < paso ? <Icono nombre="check" tamano={14} /> : i + 1}</span>
            <span className="reg-paso-texto">{t}</span>
          </li>
        ))}
      </ol>
      <div className="reg-progreso" aria-hidden="true"><div style={{ width: `${((paso + 1) / PASOS.length) * 100}%` }} /></div>

      {error && <div className="caja-error" role="alert">{error}</div>}

      {paso === 0 && (
        <div className="pila reg-paso" key="p0">
          <fieldset className="reg-roles">
            <legend>¿Qué quieres hacer en la plaza?</legend>
            {ROLES.map((r) => (
              <label key={r.valor} className={`reg-rol ${d.rol === r.valor ? "activo" : ""}`}>
                <input type="radio" name="rol" value={r.valor} checked={d.rol === r.valor} onChange={cambiar("rol")} />
                <Icono nombre={r.icono} tamano={26} />
                <strong>{r.titulo}</strong>
                <small>{r.texto}</small>
              </label>
            ))}
          </fieldset>
          {campo("email", "Correo", { type: "email", autoComplete: "email", placeholder: "tucorreo@ejemplo.com", autoFocus: true })}
          <label className={`campo ${errores.clave ? "campo-error" : ""}`}>
            <span>Contraseña</span>
            <div className="clave">
              <input className="entrada" type={verClave ? "text" : "password"} value={d.clave} onChange={cambiar("clave")}
                autoComplete="new-password" aria-invalid={Boolean(errores.clave)} aria-describedby="fuerza-clave" />
              <button type="button" className="boton boton-plano boton-icono" onClick={() => setVerClave((v) => !v)}
                aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"}>
                <Icono nombre={verClave ? "ojo-tachado" : "ojo"} />
              </button>
            </div>
            <div className="reg-fuerza" data-fuerza={fuerza} aria-hidden="true"><i /><i /><i /><i /></div>
            {errores.clave ? <small className="mensaje-error">{errores.clave}</small>
              : <small id="fuerza-clave">{d.clave ? `Seguridad: ${textoFuerza}. ` : ""}Mínimo 8 caracteres y un número; mejor si combinas mayúsculas y símbolos.</small>}
          </label>
          {campo("confirmar", "Repite la contraseña", { type: verClave ? "text" : "password", autoComplete: "new-password" })}
        </div>
      )}

      {paso === 1 && (
        <div className="pila reg-paso" key="p1">
          <div className="dos-columnas">
            {campo("nombres", "Nombres", { autoComplete: "given-name", autoFocus: true })}
            {campo("apellidos", "Apellidos", { autoComplete: "family-name" })}
          </div>
          <div className="reg-documento">
            <label className="campo">
              <span>Documento</span>
              <select className="selector" value={d.tipoDocumento} onChange={cambiar("tipoDocumento")}>
                {DOCUMENTOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
            </label>
            {campo("numeroDocumento", "Número", { inputMode: "numeric", autoComplete: "off" })}
          </div>
          <div className="dos-columnas">
            {campo("fechaNacimiento", "Fecha de nacimiento", { type: "date", max: MAX_NACIMIENTO, autoComplete: "bday" }, "Debes ser mayor de edad.")}
            <label className={`campo ${errores.telefono ? "campo-error" : ""}`}>
              <span>Celular</span>
              <div className="reg-telefono">
                <span aria-hidden="true">+57</span>
                <input className="entrada" value={d.telefono} inputMode="tel" autoComplete="tel-national" placeholder="300 123 4567"
                  onChange={(e) => poner("telefono", e.target.value.replace(/\D/g, "").slice(0, 10))} aria-invalid={Boolean(errores.telefono)} />
              </div>
              {errores.telefono ? <small className="mensaje-error">{errores.telefono}</small> : <small>Para avisarte del estado de tus pedidos.</small>}
            </label>
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="pila reg-paso" key="p2">
          <label className="campo">
            <span>Ciudad</span>
            <select className="selector" value={d.ciudad} onChange={cambiar("ciudad")} autoFocus>
              {CIUDADES.filter((c) => c !== "Todas").map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          {campo("direccion", d.rol === "vendedor" ? "Dirección de tu negocio" : "Dirección de entrega", { autoComplete: "street-address", placeholder: "Cra 9 # 27-15, barrio Centro" })}
          <div className="reg-resumen">
            <strong>Así quedará tu cuenta</strong>
            <dl>
              <dt>Nombre</dt><dd>{`${d.nombres} ${d.apellidos}`.trim()}</dd>
              <dt>Correo</dt><dd>{d.email}</dd>
              <dt>Cuenta</dt><dd>{d.rol === "vendedor" ? "Vendedor (luego solicitas tu puesto)" : "Cliente"}</dd>
              <dt>Celular</dt><dd>+57 {d.telefono}</dd>
            </dl>
          </div>
          <label className={`reg-terminos ${errores.aceptaTerminos ? "campo-error" : ""}`}>
            <input type="checkbox" checked={d.aceptaTerminos} onChange={cambiar("aceptaTerminos")} aria-invalid={Boolean(errores.aceptaTerminos)} />
            <span>Acepto los términos de uso y el tratamiento de mis datos personales para gestionar mis compras y ventas en Plaza Sinú.</span>
          </label>
          {errores.aceptaTerminos && <small className="mensaje-error">{errores.aceptaTerminos}</small>}
        </div>
      )}

      <div className="reg-acciones">
        {paso > 0 && (
          <button type="button" className="boton" onClick={() => { setPaso(paso - 1); setError(null); }}>
            <Icono nombre="atras" tamano={18} /> Atrás
          </button>
        )}
        <button className="boton boton-primario" disabled={enviando}>
          {enviando ? "Creando tu cuenta…" : paso < 2 ? <>Continuar <Icono nombre="adelante" tamano={18} /></> : "Crear mi cuenta"}
        </button>
      </div>
    </form>
  );
}
