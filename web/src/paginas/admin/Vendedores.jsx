import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/cliente.js";
import { fechaHora } from "../../api/formato.js";
import { CajaError, Cargando, Sello, Vacio } from "../../componentes/comunes.jsx";
import { usePlaza } from "../../estado/plaza.jsx";

const TONO = { PENDIENTE: "aviso", APROBADO: "exito", SUSPENDIDO: "error", RECHAZADO: "neutro" };
const TEXTO = { PENDIENTE: "Pendiente", APROBADO: "Aprobado", SUSPENDIDO: "Suspendido", RECHAZADO: "Rechazado" };
const ORDEN = { PENDIENTE: 0, SUSPENDIDO: 1, APROBADO: 2, RECHAZADO: 3 };
const FILTROS = [["", "Todos"], ["PENDIENTE", "Pendientes"], ["APROBADO", "Aprobados"], ["SUSPENDIDO", "Suspendidos"]];

export default function Vendedores() {
  const { avisar } = usePlaza();
  const [lista, setLista] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(null);

  const cargar = useCallback(() => {
    setError(null);
    api(`/vendedores${filtro ? `?estado=${filtro}` : ""}`)
      .then((r) => setLista((r.datos || []).sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado])))
      .catch(setError);
  }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);

  async function cambiar(v, estado) {
    let motivo;
    if (estado === "SUSPENDIDO") {
      motivo = window.prompt(`¿Por qué suspendes ${v.nombreTienda}? Sus productos dejarán de verse en la plaza.`);
      if (motivo === null) return;
    }
    setOcupado(v.id);
    try {
      await api(`/vendedores/${v.id}/estado`, { metodo: "PATCH", cuerpo: { estado, ...(motivo && { motivo }) } });
      avisar(estado === "APROBADO" ? `${v.nombreTienda} aprobado: su puesto ya está abierto` : `${v.nombreTienda}: ${TEXTO[estado].toLowerCase()}`, estado === "APROBADO" ? "exito" : "aviso");
      cargar();
    } catch (e) {
      setError(e);
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="pila" style={{ "--pila": "20px" }}>
      <div className="fila entre">
        <div>
          <h2>Vendedores</h2>
          <p className="secundario">Las solicitudes pendientes van primero. Aprobar un puesto publica un evento que abre sus productos en el catálogo.</p>
        </div>
        <div className="segmentado" role="group" aria-label="Filtrar por estado">
          {FILTROS.map(([v, t]) => (
            <button key={v} className={filtro === v ? "activo" : ""} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{t}</button>
          ))}
        </div>
      </div>
      <CajaError error={error} alReintentar={cargar} />
      {!lista ? <Cargando alto={110} filas={3} /> : lista.length === 0 ? (
        <div className="panel"><Vacio icono="puesto" titulo="No hay puestos en este estado" /></div>
      ) : (
        <ul className="lista-puestos">
          {lista.map((v) => (
            <li key={v.id} className={`panel puesto-admin ${v.estado === "PENDIENTE" ? "panel-destacado" : ""}`}>
              <span className="muestra-color" style={{ background: v.color }} aria-hidden="true">{v.nombreTienda.split(" ").filter((p) => p.length > 1).map((p) => p[0]).slice(0, 2).join("")}</span>
              <div className="puesto-datos">
                <div className="fila">
                  <h3>{v.nombreTienda}</h3>
                  <Sello tono={TONO[v.estado]}>{TEXTO[v.estado]}</Sello>
                </div>
                <p className="secundario">{v.descripcion}</p>
                <p className="puesto-meta">
                  <span>{v.ciudad}</span><span>{v.categoriaPrincipal}</span><span className="mono">NIT {v.nit}</span>
                  <span>Solicitado el {fechaHora(v.creadoEn)}</span>
                  {v.motivoEstado && <span>Motivo: {v.motivoEstado}</span>}
                </p>
              </div>
              <div className="puesto-acciones">
                {v.estado !== "APROBADO" && (
                  <button className="boton boton-primario boton-sm" disabled={ocupado === v.id} onClick={() => cambiar(v, "APROBADO")}>
                    {v.estado === "PENDIENTE" ? "Aprobar puesto" : "Reactivar"}
                  </button>
                )}
                {v.estado === "APROBADO" && (
                  <button className="boton boton-sm" disabled={ocupado === v.id} onClick={() => cambiar(v, "SUSPENDIDO")}>Suspender</button>
                )}
                {v.estado === "PENDIENTE" && (
                  <button className="boton boton-plano boton-sm" disabled={ocupado === v.id} onClick={() => cambiar(v, "RECHAZADO")}>Rechazar</button>
                )}
                {v.estado === "APROBADO" && <Link className="boton boton-plano boton-sm" to={`/puestos/${v.id}`}>Ver puesto</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
