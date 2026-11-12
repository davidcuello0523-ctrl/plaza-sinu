// Mapa de servicios en vivo: navegador → gateway → 7 servicios, su base de
// datos y RabbitMQ. Estado y latencia vienen de GET /salud cada 3 s; los
// eventos que pasan por RabbitMQ hacen "latir" a quien publica y a quien consume.
import { useCallback, useState } from "react";
import { Sello } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import { IMPACTO, SERVICIOS, TEXTO_ESTADO, URL_RABBIT, URL_SWAGGER, useColas, useSalud, useSucesos } from "./monitor.js";

// Geometría del lienzo (viewBox 1120 × 600).
const BW = 140, BH = 84, BY = 232, BASE = BY + BH;
const x = (i) => 10 + i * 160;
const cx = (i) => x(i) + BW / 2;
const IDX = Object.fromEntries(SERVICIOS.map((s, i) => [s.nombre, i]));

// Llamadas REST entre servicios (igual que docs/arquitectura/02-comunicacion.mmd).
// Desplazamientos y profundidades elegidos para que los arcos casi no se crucen.
const REST = [
  { de: "catalogo", a: "vendedores", texto: "¿aprobado?", d0: -50, d1: 40, prof: 36 },
  { de: "carrito", a: "catalogo", texto: "precio", d0: -30, d1: 20, prof: 40 },
  { de: "carrito", a: "inventario", texto: "stock", d0: 10, d1: 20, prof: 78 },
  { de: "pedidos-pagos", a: "carrito", texto: "leer carrito", d0: -40, d1: 40, prof: 30 },
  { de: "pedidos-pagos", a: "catalogo", texto: "precios", d0: -15, d1: -30, prof: 108 },
  { de: "pedidos-pagos", a: "inventario", texto: "reservar", d0: 40, d1: -25, prof: 34 },
];

const estadoDe = (salud, nombre, gatewayCaido) => {
  if (gatewayCaido) return "desconocido";
  return salud?.servicios?.find((s) => s.nombre === nombre)?.estado || "desconocido";
};

function NodoServicio({ s, i, estado, info, activo, elegido, alElegir }) {
  const latencia = info?.latenciaMs != null ? `${info.latenciaMs} ms` : "sin respuesta";
  return (
    <g
      className={`nodo nodo-${estado} ${activo ? "pulso" : ""} ${elegido ? "elegido" : ""}`}
      transform={`translate(${x(i)} ${BY})`}
      role="button"
      tabIndex={0}
      aria-label={`${s.nombre}, ${TEXTO_ESTADO[estado]}, ${latencia}. Ver detalle`}
      onClick={() => alElegir(s.nombre)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), alElegir(s.nombre))}
    >
      <rect className="nodo-caja" width={BW} height={BH} rx="6" />
      <rect className="nodo-franja" width={BW} height="7" rx="3" />
      <text className="nodo-nombre" x="12" y="32">{s.nombre}</text>
      <text className="nodo-puerto" x="12" y="50">:{s.puerto}</text>
      <text className="nodo-estado" x="12" y="72">{TEXTO_ESTADO[estado]}</text>
      <text className="nodo-latencia" x={BW - 12} y="72" textAnchor="end">{info?.latenciaMs != null ? `${info.latenciaMs} ms` : "—"}</text>
    </g>
  );
}

function Cilindro({ s, i, estado }) {
  const w = 104, h = 54, x0 = cx(i) - w / 2, y0 = 446;
  return (
    <g className={`bd bd-${estado}`} aria-hidden="true">
      <path d={`M${x0} ${y0 + 8} v${h - 16} a${w / 2} 8 0 0 0 ${w} 0 v${-(h - 16)}`} className="bd-cuerpo" />
      <ellipse cx={cx(i)} cy={y0 + 8} rx={w / 2} ry="8" className="bd-tapa" />
      <text x={cx(i)} y={y0 + 32} textAnchor="middle" className="bd-motor">{s.motor}</text>
      <text x={cx(i)} y={y0 + 46} textAnchor="middle" className="bd-nombre">{s.bd}</text>
    </g>
  );
}

function Lienzo({ salud, gatewayCaido, activos, elegido, alElegir }) {
  const rabbit = gatewayCaido ? "desconocido" : salud?.rabbitmq?.estado || "desconocido";
  const est = (n) => estadoDe(salud, n, gatewayCaido);
  return (
    <svg className="lienzo" viewBox="0 0 1120 600" role="group" aria-labelledby="titulo-mapa desc-mapa">
      <title id="titulo-mapa">Mapa de servicios de Plaza Sinú</title>
      <desc id="desc-mapa">El navegador habla solo con el gateway; el gateway enruta a 7 microservicios, cada uno con su base de datos, y todos publican o consumen eventos en RabbitMQ.</desc>
      <defs>
        <marker id="punta-rest" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="#F07A55" />
        </marker>
      </defs>

      {/* Navegador → gateway */}
      <g className="nodo-externo">
        <rect x="450" y="8" width="220" height="46" rx="6" />
        <text x="560" y="37" textAnchor="middle">Navegador (web :3000)</text>
      </g>
      <line x1="560" y1="54" x2="560" y2="88" className="enlace-rest" markerEnd="url(#punta-rest)" />
      <g className={`nodo-gateway ${gatewayCaido ? "caido" : ""} ${activos.gateway ? "pulso" : ""}`}>
        <rect x="400" y="88" width="320" height="66" rx="6" />
        <text x="560" y="116" textAnchor="middle" className="gw-nombre">API Gateway :8080</text>
        <text x="560" y="138" textAnchor="middle" className="gw-detalle">
          {gatewayCaido ? "No responde" : "JWT, enrutamiento, correlationId y rate limit"}
        </text>
      </g>

      {/* Tronco del gateway hacia cada servicio */}
      <line x1="560" y1="154" x2="560" y2="186" className="enlace-rest" />
      <line x1={cx(0)} y1="186" x2={cx(6)} y2="186" className="enlace-rest" />
      {SERVICIOS.map((s, i) => (
        <line key={s.nombre} x1={cx(i)} y1="186" x2={cx(i)} y2={BY - 2}
          className={`enlace-rest ${est(s.nombre) === "caido" ? "enlace-caido" : ""}`} markerEnd="url(#punta-rest)" />
      ))}

      {/* REST entre servicios: arcos naranjas bajo las cajas */}
      {REST.map((r) => {
        const x0 = cx(IDX[r.de]) + r.d0, x1 = cx(IDX[r.a]) + r.d1, y = BASE + r.prof;
        const caido = est(r.de) === "caido" || est(r.a) === "caido";
        return (
          <g key={r.de + r.a}>
            <path d={`M${x0} ${BASE} C${x0} ${y} ${x1} ${y} ${x1} ${BASE + 2}`}
              className={`enlace-rest ${caido ? "enlace-caido" : ""}`} markerEnd="url(#punta-rest)" />
            <text x={(x0 + x1) / 2} y={BASE + r.prof * 0.75 + 4} textAnchor="middle" className="etiqueta-enlace">{r.texto}</text>
          </g>
        );
      })}

      {/* Cada servicio con su base de datos propia */}
      {SERVICIOS.map((s, i) => (
        <line key={`bd-${s.nombre}`} x1={cx(i) + 58} y1={BASE} x2={cx(i) + 40} y2="448" className="enlace-bd" />
      ))}
      {SERVICIOS.map((s, i) => {
        const dep = salud?.servicios?.find((x) => x.nombre === s.nombre)?.dependencias?.[s.clave];
        const estadoBd = est(s.nombre) === "caido" || gatewayCaido ? "desconocido" : dep === "ok" ? "ok" : dep ? "caido" : "desconocido";
        return <Cilindro key={s.nombre} s={s} i={i} estado={estadoBd} />;
      })}

      {/* Eventos: cada servicio publica/consume en RabbitMQ */}
      {SERVICIOS.map((s, i) => (
        <line key={`ev-${s.nombre}`} x1={x(i) + 12} y1={BASE} x2={x(i) + 12} y2="548"
          className={`enlace-evento ${activos[s.nombre] ? "enlace-activo" : ""} ${est(s.nombre) === "caido" ? "enlace-caido" : ""}`} />
      ))}
      <g className={`bus bus-${rabbit}`}>
        <rect x="10" y="548" width="1100" height="42" rx="6" />
        <text x="26" y="574" className="bus-nombre">RabbitMQ</text>
        <text x="120" y="574" className="bus-detalle">exchange topic plaza.eventos, una cola durable por consumidor</text>
        <text x="1094" y="574" textAnchor="end" className="bus-estado">{TEXTO_ESTADO[rabbit]}</text>
      </g>

      {SERVICIOS.map((s, i) => (
        <NodoServicio key={s.nombre} s={s} i={i} estado={est(s.nombre)} activo={activos[s.nombre]}
          info={salud?.servicios?.find((x) => x.nombre === s.nombre)} elegido={elegido === s.nombre} alElegir={alElegir} />
      ))}
    </svg>
  );
}

function Detalle({ nombre, salud, gatewayCaido, alCerrar }) {
  const s = SERVICIOS.find((x) => x.nombre === nombre);
  const info = salud?.servicios?.find((x) => x.nombre === nombre);
  const estado = estadoDe(salud, nombre, gatewayCaido);
  return (
    <section className="panel panel-destacado detalle-servicio" aria-live="polite">
      <div className="fila entre">
        <h3><span className="chip-servicio" data-servicio={nombre}>{nombre}</span></h3>
        <button className="boton boton-plano boton-icono" onClick={alCerrar} aria-label="Cerrar detalle"><Icono nombre="x" /></button>
      </div>
      <p>{s.resp}.</p>
      <dl className="datos-servicio">
        <dt>Estado</dt><dd><Sello tono={estado === "ok" ? "exito" : estado === "caido" ? "error" : "aviso"} plano>{TEXTO_ESTADO[estado]}</Sello></dd>
        <dt>Latencia</dt><dd className="mono">{info?.latenciaMs != null ? `${info.latenciaMs} ms` : "sin respuesta"}</dd>
        <dt>Puerto interno</dt><dd className="mono">{s.puerto}</dd>
        <dt>Base de datos</dt><dd>{s.motor} <span className="mono secundario">{s.bd}</span></dd>
        {Object.entries(info?.dependencias || {}).map(([dep, v]) => (
          <div key={dep} className="contents"><dt>Conexión {dep}</dt><dd>{v === "ok" ? "Conectado" : "Sin conexión"}</dd></div>
        ))}
      </dl>
      <a className="boton boton-sm" href={`${URL_SWAGGER}?urls.primaryName=${encodeURIComponent(nombre)}`} target="_blank" rel="noreferrer">
        <Icono nombre="documento" tamano={18} /> Ver su API en Swagger
      </a>
    </section>
  );
}

function Colas() {
  const colas = useColas();
  const principales = colas.filter((c) => !c.nombre.endsWith(".dlq"));
  const muertas = colas.filter((c) => c.nombre.endsWith(".dlq") && c.mensajes > 0);
  return (
    <section className="panel b-3">
      <div className="fila entre"><h3>Colas de RabbitMQ</h3><a href={URL_RABBIT} target="_blank" rel="noreferrer" className="secundario">Abrir panel (plaza / plaza)</a></div>
      {colas.length === 0 ? <p className="secundario" style={{ marginTop: 12 }}>Consultando el broker…</p> : (
        <ul className="colas">
          {principales.map((c) => {
            const esperando = c.mensajes > 0 && c.consumidores === 0;
            return (
              <li key={c.nombre} className={esperando ? "cola-esperando" : ""}>
                <span className="mono">{c.nombre}</span>
                <span className="cola-cifras">
                  <b className="cifra">{c.mensajes}</b> en cola
                  <span className="secundario">{c.consumidores} {c.consumidores === 1 ? "consumidor" : "consumidores"}</span>
                </span>
                {esperando && <Sello tono="aviso" plano>Esperando a su consumidor</Sello>}
              </li>
            );
          })}
        </ul>
      )}
      {muertas.length > 0 && <p className="caja-aviso" style={{ marginTop: 12 }}>Hay mensajes en colas de mensajes muertos: {muertas.map((c) => `${c.nombre} (${c.mensajes})`).join(", ")}.</p>}
    </section>
  );
}

export default function Mapa() {
  const { salud, gatewayCaido } = useSalud();
  const [elegido, setElegido] = useState(null);
  const [activos, setActivos] = useState({});

  // Hace latir 1.2 s a quien publica y a quienes consumen cada evento.
  const alSuceso = useCallback((suceso) => {
    const nombres = suceso.clase === "http" ? ["gateway"] : [suceso.origen, ...(suceso.consumidores || [])];
    setActivos((a) => ({ ...a, ...Object.fromEntries(nombres.map((n) => [n, true])) }));
    setTimeout(() => setActivos((a) => ({ ...a, ...Object.fromEntries(nombres.map((n) => [n, false])) })), 1200);
  }, []);
  const enVivo = useSucesos(alSuceso);

  const caidos = gatewayCaido ? [] : (salud?.servicios || []).filter((s) => s.estado !== "ok");
  const enLinea = (salud?.servicios || []).filter((s) => s.estado === "ok").length;

  return (
    <div className="pila" style={{ "--pila": "20px" }}>
      <div className="fila entre">
        <div>
          <h2>Mapa de servicios</h2>
          <p className="secundario">Se actualiza cada 3 segundos desde <span className="mono">GET /salud</span> del gateway. Toca un servicio para ver su detalle.</p>
        </div>
        <div className="fila">
          {gatewayCaido ? <Sello tono="error">Gateway sin respuesta</Sello>
            : <Sello tono={caidos.length ? "aviso" : "exito"}>{enLinea} de 7 servicios en línea</Sello>}
          <Sello tono={enVivo ? "rio" : "neutro"} plano>{enVivo ? "Eventos en vivo" : "Conectando eventos…"}</Sello>
        </div>
      </div>

      {gatewayCaido && <div className="caja-error" role="alert"><strong>El gateway no responde.</strong> Es la única puerta de entrada: sin él el navegador no llega a ningún servicio. Revisa <span className="mono">docker compose ps gateway</span>.</div>}
      {caidos.map((s) => (
        <div key={s.nombre} className={s.estado === "caido" ? "caja-error" : "caja-aviso"} role="alert">
          <strong>{s.nombre} {s.estado === "caido" ? "no responde" : "está degradado"}:</strong> {IMPACTO[s.nombre]}.
          {s.estado === "degradado" && Object.entries(s.dependencias).filter(([, v]) => v !== "ok").map(([d]) => ` Perdió conexión con ${d}.`)}
        </div>
      ))}
      {salud?.rabbitmq?.estado === "caido" && <div className="caja-error" role="alert"><strong>RabbitMQ no responde:</strong> las compras siguen por REST, pero los eventos se guardan en memoria hasta que el broker vuelva.</div>}

      <div className="panel panel-rio lienzo-panel">
        <div className="leyenda" aria-label="Leyenda">
          <span><i className="ley-rest" /> REST síncrono</span>
          <span><i className="ley-evento" /> Evento RabbitMQ</span>
          <span><i className="ley-ok" /> En línea</span>
          <span><i className="ley-degradado" /> Degradado</span>
          <span><i className="ley-caido" /> Caído</span>
        </div>
        <Lienzo salud={salud} gatewayCaido={gatewayCaido} activos={activos} elegido={elegido} alElegir={setElegido} />

        {/* Móvil: el diagrama se vuelve una lista de tarjetas */}
        <ul className="mapa-lista">
          {SERVICIOS.map((s) => {
            const estado = estadoDe(salud, s.nombre, gatewayCaido);
            const info = salud?.servicios?.find((x) => x.nombre === s.nombre);
            return (
              <li key={s.nombre}>
                <button className={`tarjeta-servicio nodo-${estado} ${activos[s.nombre] ? "pulso" : ""}`} onClick={() => setElegido(s.nombre)}>
                  <span className="fila entre"><strong>{s.nombre}</strong><span className="mono">:{s.puerto}</span></span>
                  <span className="fila entre"><span>{TEXTO_ESTADO[estado]}</span><span className="mono">{info?.latenciaMs != null ? `${info.latenciaMs} ms` : "—"}</span></span>
                  <span className="secundario">{s.motor}, {s.bd}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {elegido && <Detalle nombre={elegido} salud={salud} gatewayCaido={gatewayCaido} alCerrar={() => setElegido(null)} />}

      <div className="bento">
        <Colas />
        <section className="panel b-3">
          <h3>Quién hace qué</h3>
          <ul className="lista-servicios">
            {SERVICIOS.map((s) => (
              <li key={s.nombre}>
                <span className="chip-servicio" data-servicio={s.nombre}>{s.nombre}</span>
                <span>{s.resp}</span>
                <span className="mono secundario">:{s.puerto}, {s.motor}</span>
              </li>
            ))}
          </ul>
          <p className="secundario" style={{ marginTop: 12 }}>
            Solo el gateway (8080), la web (3000) y el panel de RabbitMQ (15672) están expuestos; servicios y bases viven en la red interna de Docker.
          </p>
        </section>
      </div>
    </div>
  );
}
