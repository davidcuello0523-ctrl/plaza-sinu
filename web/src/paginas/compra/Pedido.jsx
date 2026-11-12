// Detalle del pedido + TRAZA: qué microservicio hizo cada paso, si fue por REST
// o por evento (RabbitMQ), cuándo y con qué correlationId. Se actualiza sola.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, urlRecurso } from "../../api/cliente.js";
import { fechaHora, hora, pesos } from "../../api/formato.js";
import { CajaError, Cargando, ChipServicio, Sello, Vacio } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import { usePlaza } from "../../estado/plaza.jsx";
import { useSesion } from "../../estado/sesion.jsx";
import { FormularioPago } from "./compartidos.jsx";
import "../../estilos/compra.css";

const SIGUIENTE = { PAGADO: "PREPARANDO", PREPARANDO: "ENVIADO", ENVIADO: "ENTREGADO" };
const TEXTO_AVANCE = { PREPARANDO: "Marcar en preparación", ENVIADO: "Marcar como enviado", ENTREGADO: "Marcar como entregado" };
const HECHO = { PREPARANDO: "en preparación", ENVIADO: "enviado", ENTREGADO: "entregado" };

const LEYENDA = [
  ["carrito", "lee y valida el carrito"],
  ["catalogo", "congela los precios"],
  ["inventario", "reserva y descuenta stock"],
  ["pedidos-pagos", "crea el pedido y cobra"],
  ["notificaciones", "avisa a cliente y vendedor"],
];

function Copiar({ texto, etiqueta = "Copiar" }) {
  const [hecho, setHecho] = useState(false);
  return (
    <button type="button" className="boton boton-sm" onClick={async () => {
      try { await navigator.clipboard.writeText(texto); setHecho(true); setTimeout(() => setHecho(false), 1500); } catch { /* sin portapapeles */ }
    }}>
      <Icono nombre={hecho ? "check" : "documento"} tamano={16} /> {hecho ? "Copiado" : etiqueta}
    </button>
  );
}

function Traza({ traza }) {
  const pasos = traza.pasos;
  const ids = [...new Set(pasos.map((p) => p.correlationId))];
  const primero = ids[0] || traza.pedido.correlationId;
  const comando = `docker compose logs --no-log-prefix | Select-String "${primero}"`;
  return (
    <section className="panel traza" aria-labelledby="titulo-traza">
      <div className="traza-cabeza">
        <div>
          <h2 id="titulo-traza">Traza del pedido</h2>
          <p className="secundario">Cada paso muestra el microservicio que lo hizo. Los pasos asíncronos aparecen solos, sin recargar.</p>
        </div>
        <div className="traza-ids">
          {ids.map((id, i) => (
            <div key={id} className="fila traza-id">
              <span className="secundario">{i === 0 ? "Petición de compra" : `Petición ${i + 1}`}</span>
              <code className="mono">{id}</code>
              <Copiar texto={id} />
            </div>
          ))}
          <div className="comando">
            <span className="secundario">Seguir esta compra en los logs (PowerShell):</span>
            <div className="fila">
              <code className="mono">{comando}</code>
              <Copiar texto={comando} etiqueta="Copiar comando" />
            </div>
          </div>
        </div>
      </div>

      <ul className="leyenda-traza" aria-label="Leyenda">
        {LEYENDA.map(([s, t]) => <li key={s}><ChipServicio servicio={s} /> <span className="secundario">{t}</span></li>)}
        <li><span className="nodo-muestra nodo-rest" aria-hidden="true" /> <span className="secundario">REST (síncrono)</span></li>
        <li><span className="nodo-muestra nodo-evento" aria-hidden="true" /> <span className="secundario">Evento RabbitMQ (asíncrono)</span></li>
      </ul>

      {pasos.length === 0 ? (
        <p className="secundario">Este pedido todavía no tiene pasos registrados.</p>
      ) : (
        <ol className="linea-tiempo">
          {pasos.map((p, i) => (
            <li key={p.id} className={`paso paso-${p.via === "EVENTO" ? "evento" : "rest"}`} data-servicio={p.servicio}>
              {i > 0 && p.correlationId !== pasos[i - 1].correlationId && (
                <div className="paso-corte mono">nueva petición {p.correlationId.slice(0, 8)}</div>
              )}
              <span className="paso-nodo" aria-hidden="true" />
              <div className="paso-cuerpo">
                <div className="fila">
                  <ChipServicio servicio={p.servicio} />
                  <strong>{p.accion}</strong>
                </div>
                {p.detalle && <p className="secundario">{p.detalle}</p>}
                <div className="fila paso-meta">
                  <span className={`via via-${p.via === "EVENTO" ? "evento" : "rest"}`}>{p.via === "EVENTO" ? "Evento" : "REST"}</span>
                  <time className="mono" dateTime={p.ocurridoEn}>{hora(p.ocurridoEn)}</time>
                  <span className="mono secundario" title={p.correlationId}>{p.correlationId.slice(0, 8)}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default function Pedido() {
  const { id } = useParams();
  const { usuario } = useSesion();
  const { alNotificar, avisar, recargarCarrito } = usePlaza();
  const [pedido, setPedido] = useState(null);
  const [traza, setTraza] = useState(null);
  const [error, setError] = useState(null);
  const [pagando, setPagando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorAccion, setErrorAccion] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [p, t] = await Promise.all([api(`/pedidos/${id}`), api(`/pedidos/${id}/traza`)]);
      setPedido(p); setTraza(t); setError(null);
    } catch (e) { setError(e); }
  }, [id]);

  useEffect(() => { setPedido(null); cargar(); }, [cargar]);

  // Actualización en vivo: notificaciones SSE del pedido + sondeo corto para los pasos asíncronos.
  useEffect(() => alNotificar((n) => { if (n.pedidoId === id) cargar(); }), [alNotificar, id, cargar]);
  useEffect(() => {
    const t = setInterval(cargar, 3000);
    const fin = setTimeout(() => clearInterval(t), 30000);
    return () => { clearInterval(t); clearTimeout(fin); };
  }, [cargar]);

  async function accion(fn) {
    setEnviando(true); setErrorAccion(null);
    try { await fn(); await cargar(); } catch (e) { setErrorAccion(e); } finally { setEnviando(false); }
  }

  const avanzar = (sub) => accion(async () => {
    await api(`/pedidos/${id}/estado`, { metodo: "PATCH", cuerpo: { subpedidoId: sub.id, estado: SIGUIENTE[sub.estado] } });
    avisar(`${sub.nombreTienda}: sub-pedido ${HECHO[SIGUIENTE[sub.estado]]}`, "exito");
  });
  const cancelar = () => accion(async () => {
    await api(`/pedidos/${id}/cancelar`, { metodo: "POST" });
    avisar(`Pedido ${pedido.codigo} cancelado`);
  });
  const pagar = (tarjeta) => accion(async () => {
    try {
      await api(`/pedidos/${id}/pagos`, { metodo: "POST", cuerpo: tarjeta });
      setPagando(false);
      recargarCarrito();
    } catch (e) {
      if (e.status === 402) setPagando(false);
      throw e;
    }
  });

  if (error?.status === 404) {
    return <div className="contenedor pagina"><Vacio icono="caja" titulo="No encontramos ese pedido" accion={<Link to="/pedidos" className="boton">Ver mis pedidos</Link>}>Puede que el enlace esté incompleto.</Vacio></div>;
  }
  if (error?.status === 403) {
    return <div className="contenedor pagina"><Vacio icono="alerta" titulo="Este pedido no es tuyo" accion={<Link to="/pedidos" className="boton">Ver mis pedidos</Link>}>Solo el cliente que compró, los puestos involucrados y el administrador pueden verlo.</Vacio></div>;
  }
  if (error && !pedido) return <div className="contenedor pagina"><CajaError error={error} alReintentar={cargar} /></div>;
  if (!pedido || !traza) return <div className="contenedor pagina"><Cargando alto={140} filas={3} /></div>;

  const esCliente = usuario?.id === pedido.clienteId;
  const pagoAprobado = pedido.pagos?.find((p) => p.estado === "APROBADO");
  const pagoRechazado = pedido.pagos?.find((p) => p.estado === "RECHAZADO");

  return (
    <div className="contenedor pagina pila" style={{ "--pila": "24px" }}>
      <Link to="/pedidos" className="boton boton-plano boton-sm volver-pedidos"><Icono nombre="atras" tamano={18} /> Pedidos</Link>

      <header className="pedido-cabeza panel panel-destacado">
        <div>
          <span className="secundario">Pedido</span>
          <h1 className="mono codigo-grande">{pedido.codigo}</h1>
          <p className="secundario">{fechaHora(pedido.creadoEn)} · {pedido.unidades} {pedido.unidades === 1 ? "unidad" : "unidades"} · {pedido.direccion?.ciudad}</p>
        </div>
        <div className="pedido-cabeza-lado">
          <Sello estado={pedido.estado} />
          <strong className="cifra total-grande">{pesos(pedido.total)}</strong>
          {pagoAprobado && <span className="secundario">{pagoAprobado.marca} •••• {pagoAprobado.ultimos4}</span>}
        </div>
      </header>

      {pedido.motivo && <div className={pedido.estado === "CANCELADO" ? "caja-aviso" : "caja-error"}>{pedido.motivo}{pagoRechazado && ` (tarjeta •••• ${pagoRechazado.ultimos4})`}</div>}
      {errorAccion && <CajaError error={errorAccion} />}

      {esCliente && pedido.estado === "PENDIENTE_PAGO" && (
        <section className="panel pila">
          <div className="fila entre">
            <div>
              <h2>Este pedido espera tu pago</h2>
              <p className="secundario">Tus unidades siguen reservadas. Si no pagas en 15 minutos, la reserva se libera sola.</p>
            </div>
            {!pagando && (
              <div className="fila">
                <button className="boton boton-primario" onClick={() => setPagando(true)}>Pagar ahora</button>
                <button className="boton" disabled={enviando} onClick={cancelar}>Cancelar pedido</button>
              </div>
            )}
          </div>
          {pagando && <FormularioPago onPagar={pagar} enviando={enviando} textoBoton={`Pagar ${pesos(pedido.total)}`} />}
        </section>
      )}

      <div className="pedido-columnas">
        <section className="pila" aria-label="Sub-pedidos por puesto">
          {pedido.subpedidos.map((s) => {
            const esMio = usuario?.rol === "vendedor" && s.vendedorUsuarioId === usuario.id;
            const puedeAvanzar = (esMio || usuario?.rol === "admin") && SIGUIENTE[s.estado];
            return (
              <article key={s.id} className="panel subpedido">
                <div className="fila entre">
                  <h3><Icono nombre="puesto" tamano={18} /> {s.nombreTienda}</h3>
                  <Sello estado={s.estado} />
                </div>
                <ul className="items-pedido">
                  {s.items.map((it) => (
                    <li key={it.id}>
                      <img src={urlRecurso(it.imagen)} alt="" loading="lazy" />
                      <span>{it.nombre}</span>
                      <span className="secundario">{it.cantidad} × {pesos(it.precioUnitario)}</span>
                      <strong className="cifra">{pesos(it.subtotal)}</strong>
                    </li>
                  ))}
                </ul>
                <div className="fila entre">
                  <span className="secundario">Subtotal</span>
                  <strong className="cifra">{pesos(s.subtotal)}</strong>
                </div>
                {puedeAvanzar && (
                  <button className="boton boton-rio" disabled={enviando} onClick={() => avanzar(s)}>
                    <Icono nombre={SIGUIENTE[s.estado] === "ENVIADO" ? "camion" : "check"} tamano={18} /> {TEXTO_AVANCE[SIGUIENTE[s.estado]]}
                  </button>
                )}
              </article>
            );
          })}
          {pedido.direccion && (
            <div className="panel direccion-envio">
              <h3>Envío</h3>
              <p>{pedido.direccion.nombreRecibe} · {pedido.direccion.telefono}</p>
              <p className="secundario">{pedido.direccion.direccion}, {pedido.direccion.ciudad}</p>
              {pedido.direccion.indicaciones && <p className="secundario">{pedido.direccion.indicaciones}</p>}
            </div>
          )}
        </section>

        <Traza traza={traza} />
      </div>
    </div>
  );
}
