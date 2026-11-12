import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../api/cliente.js";
import { hora } from "../../api/formato.js";
import { CajaError, ChipServicio, Sello, Vacio } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import { useSucesos } from "./monitor.js";

const MAX = 300;
const clave = (s) => s.id || `${s.tipo}-${s.ocurridoEn}-${s.correlationId}`;

export default function Eventos() {
  const [sucesos, setSucesos] = useState([]);
  const [error, setError] = useState(null);
  const [tipo, setTipo] = useState(null);
  const [correlacion, setCorrelacion] = useState("");
  const [pausado, setPausado] = useState(false);
  const pausaRef = useRef(false);
  pausaRef.current = pausado;
  const enCola = useRef([]);

  useEffect(() => {
    api("/monitor/eventos")
      .then((r) => setSucesos((r.datos || []).slice().reverse().slice(0, MAX)))
      .catch(setError);
  }, []);

  const alSuceso = useCallback((s) => {
    if (pausaRef.current) { enCola.current.unshift(s); return; }
    setSucesos((lista) => (lista.some((x) => clave(x) === clave(s)) ? lista : [s, ...lista].slice(0, MAX)));
  }, []);
  const enVivo = useSucesos(alSuceso);

  const reanudar = () => {
    setSucesos((lista) => [...enCola.current, ...lista].slice(0, MAX));
    enCola.current = [];
    setPausado(false);
  };

  const conteo = useMemo(() => {
    const c = {};
    for (const s of sucesos) c[s.tipo] = (c[s.tipo] || 0) + 1;
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [sucesos]);

  const visibles = sucesos.filter((s) => (!tipo || s.tipo === tipo) && (!correlacion || s.correlationId?.includes(correlacion.trim())));

  const seguirCompra = (id) => {
    setCorrelacion(id);
    navigator.clipboard?.writeText(id).catch(() => {});
  };

  return (
    <div className="pila" style={{ "--pila": "20px" }}>
      <div className="fila entre">
        <div>
          <h2>Radar de eventos</h2>
          <p className="secundario">Cada evento publicado en <span className="mono">plaza.eventos</span>: quién lo emitió, quién lo consume y a qué compra pertenece.</p>
        </div>
        <div className="fila">
          <Sello tono={enVivo ? "exito" : "neutro"} plano>{enVivo ? "En vivo" : "Reconectando…"}</Sello>
          {pausado
            ? <button className="boton boton-sm boton-primario" onClick={reanudar}>Reanudar ({enCola.current.length} nuevos)</button>
            : <button className="boton boton-sm" onClick={() => setPausado(true)}>Pausar</button>}
        </div>
      </div>

      <CajaError error={error} />

      <div className="panel radar-filtros">
        <div className="chips-tipo" role="group" aria-label="Filtrar por tipo de evento">
          <button className={`chip-filtro ${!tipo ? "activo" : ""}`} aria-pressed={!tipo} onClick={() => setTipo(null)}>
            Todos <b>{sucesos.length}</b>
          </button>
          {conteo.map(([t, n]) => (
            <button key={t} className={`chip-filtro ${tipo === t ? "activo" : ""}`} aria-pressed={tipo === t} onClick={() => setTipo(tipo === t ? null : t)}>
              <span className="mono">{t}</span> <b>{n}</b>
            </button>
          ))}
        </div>
        <label className="campo filtro-correlacion">
          <span>Seguir una compra por correlationId</span>
          <div className="fila" style={{ flexWrap: "nowrap" }}>
            <input className="entrada mono" value={correlacion} onChange={(e) => setCorrelacion(e.target.value)} placeholder="Pega o toca un correlationId" />
            {correlacion && <button className="boton boton-plano boton-icono" onClick={() => setCorrelacion("")} aria-label="Quitar filtro"><Icono nombre="x" /></button>}
          </div>
        </label>
      </div>

      {visibles.length === 0 ? (
        <div className="panel"><Vacio icono="radar" titulo="Todavía no pasa nada por aquí">Inicia sesión como cliente en otra ventana y compra algo: cada paso aparecerá en este radar.</Vacio></div>
      ) : (
        <ol className="radar" aria-live="polite" aria-relevant="additions">
          {visibles.map((s) => (
            <li key={clave(s)} className={`radar-fila ${s.clase === "http" ? "radar-http" : ""}`}>
              <time className="mono radar-hora" dateTime={s.ocurridoEn}>{hora(s.ocurridoEn)}</time>
              <div className="radar-cuerpo">
                <div className="fila radar-ruta">
                  {s.clase === "http" ? <span className="sello sello-plano sello-neutro">REST</span> : <span className="sello sello-plano sello-rio">Evento</span>}
                  <span className="mono radar-tipo">{s.clase === "http" ? s.ruta : s.tipo}</span>
                </div>
                <div className="fila radar-actores">
                  <ChipServicio servicio={s.origen} />
                  {s.clase !== "http" && (s.consumidores?.length ? (
                    <><span className="secundario">llega a</span>{s.consumidores.map((c) => <ChipServicio key={c} servicio={c} />)}</>
                  ) : <span className="secundario">sin consumidores</span>)}
                  {s.clase === "http" && <span className="secundario">respondió {s.status}</span>}
                </div>
                {s.resumen && <p className="radar-resumen">{s.resumen}</p>}
              </div>
              <button className="radar-correlacion mono" onClick={() => seguirCompra(s.correlationId)} title="Copiar y filtrar por este correlationId">
                {s.correlationId?.slice(0, 8)}
                <span className="solo-lectores">Filtrar por correlationId {s.correlationId}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="secundario">
        Para ver la misma compra en los logs: <span className="mono">docker compose logs --no-log-prefix | Select-String "{correlacion || "<correlationId>"}"</span>
      </p>
    </div>
  );
}
