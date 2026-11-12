import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/cliente.js";
import { CIUDADES, pesos } from "../../api/formato.js";
import { CajaError, Cargando, Vacio } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import { usePlaza } from "../../estado/plaza.jsx";
import { useSesion } from "../../estado/sesion.jsx";
import { colorDeTienda, FormularioPago, FranjaToldo } from "./compartidos.jsx";
import "../../estilos/compra.css";

function Cuenta({ hasta }) {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setAhora(Date.now()), 1000); return () => clearInterval(t); }, []);
  const s = Math.max(0, Math.round((hasta - ahora) / 1000));
  return <span className="cifra">{String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}</span>;
}

export default function Checkout() {
  const { usuario } = useSesion();
  const { recargarCarrito, avisar } = usePlaza();
  const navegar = useNavigate();
  const [carrito, setCarrito] = useState(null);
  const [errorCarga, setErrorCarga] = useState(null);
  const [direccion, setDireccion] = useState({
    nombreRecibe: usuario?.nombre || "", telefono: "", ciudad: "Montería", direccion: "", indicaciones: "",
  });
  const [clave, setClave] = useState(() => crypto.randomUUID());
  const [pedido, setPedido] = useState(null);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    api("/carrito").then(setCarrito).catch(setErrorCarga);
  }, []);

  const cambiar = (campo) => (e) => setDireccion((d) => ({ ...d, [campo]: e.target.value }));

  async function generarPedido(e) {
    e?.preventDefault();
    setEnviando(true); setError(null);
    try {
      const cuerpo = { direccion: { ...direccion, indicaciones: direccion.indicaciones || undefined } };
      setPedido(await api("/pedidos", { metodo: "POST", cuerpo, headers: { "idempotency-key": clave } }));
    } catch (err) {
      if (err.status === 409) setClave(crypto.randomUUID());
      setError(err);
    } finally {
      setEnviando(false);
    }
  }

  async function pagar(tarjeta) {
    setEnviando(true); setError(null);
    try {
      await api(`/pedidos/${pedido.id}/pagos`, { metodo: "POST", cuerpo: tarjeta });
      avisar(`Pago aprobado – pedido ${pedido.codigo}`, "exito");
      recargarCarrito();
      navegar(`/pedidos/${pedido.id}`);
    } catch (err) {
      if (err.status === 402) {
        setPedido(null);
        setClave(crypto.randomUUID());
      }
      setError(err);
    } finally {
      setEnviando(false);
    }
  }

  if (errorCarga) return <div className="contenedor pagina"><CajaError error={errorCarga} /></div>;
  if (!carrito) return <div className="contenedor pagina"><Cargando alto={160} filas={2} /></div>;
  if (!pedido && carrito.grupos.length === 0) {
    return (
      <div className="contenedor pagina">
        <Vacio principal icono="carrito" titulo="No hay nada que pagar" accion={<Link to="/catalogo" className="boton boton-primario">Ir al catálogo</Link>}>
          Agrega productos al carrito para generar un pedido.
        </Vacio>
      </div>
    );
  }

  const sinStock = error?.status === 409 && error.detalles?.filter((d) => d.productoId);
  const venceEn = pedido ? new Date(pedido.creadoEn).getTime() + 15 * 60 * 1000 : 0;

  return (
    <div className="contenedor pagina">
      <h1>Finalizar compra</h1>
      <ol className="pasos-checkout" aria-label="Pasos de la compra">
        <li className={pedido ? "hecho" : "actual"} aria-current={!pedido ? "step" : undefined}>Dirección y reserva</li>
        <li className={pedido ? "actual" : ""} aria-current={pedido ? "step" : undefined}>Pago</li>
      </ol>

      <div className="compra-columnas">
        <div className="pila" style={{ "--pila": "20px" }}>
          {error && (
            <div className="caja-error" role="alert">
              {error.status === 402 ? (
                <>
                  <strong>{error.message}</strong>
                  <p>Las unidades que tenías reservadas ya se liberaron y tu carrito sigue intacto. Puedes generar un pedido nuevo y pagar con otra tarjeta.</p>
                </>
              ) : error.status === 409 && sinStock?.length ? (
                <>
                  <strong>{error.message}</strong>
                  <ul>{sinStock.map((d) => <li key={d.productoId}>{d.nombreProducto || d.productoId}: pediste {d.solicitado}, quedan {d.disponible}</li>)}</ul>
                  <Link to="/carrito" className="boton boton-sm">Ajustar el carrito</Link>
                </>
              ) : error.status === 503 ? (
                <>
                  <strong>{error.message}</strong>
                  <p>No se creó ningún pedido ni se tocó tu carrito. Intenta de nuevo en unos segundos.</p>
                </>
              ) : (
                <>
                  <strong>{error.message}</strong>
                  {error.detalles?.some((d) => d.mensaje) && (
                    <ul>{error.detalles.filter((d) => d.mensaje).map((d, i) => <li key={i}>{d.mensaje}{d.campo ? ` (${d.campo})` : ""}</li>)}</ul>
                  )}
                </>
              )}
              {error.correlationId && <p className="mono">correlationId {error.correlationId}</p>}
            </div>
          )}

          {!pedido ? (
            <form className="panel pila" onSubmit={generarPedido}>
              <h2>¿A dónde lo enviamos?</h2>
              <div className="dos-columnas">
                <label className="campo"><span>Quién recibe</span>
                  <input className="entrada" value={direccion.nombreRecibe} onChange={cambiar("nombreRecibe")} autoComplete="name" required minLength={2} />
                </label>
                <label className="campo"><span>Teléfono</span>
                  <input className="entrada" value={direccion.telefono} onChange={cambiar("telefono")} inputMode="tel" autoComplete="tel" required minLength={7} />
                </label>
              </div>
              <label className="campo"><span>Ciudad</span>
                <select className="selector" value={direccion.ciudad} onChange={cambiar("ciudad")}>
                  {CIUDADES.filter((c) => c !== "Todas").map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="campo"><span>Dirección</span>
                <input className="entrada" value={direccion.direccion} onChange={cambiar("direccion")} placeholder="Cra 9 # 27-15, barrio Centro" autoComplete="street-address" required minLength={5} />
              </label>
              <label className="campo"><span>Indicaciones (opcional)</span>
                <input className="entrada" value={direccion.indicaciones} onChange={cambiar("indicaciones")} placeholder="Casa esquinera, portón verde" />
              </label>
              <button className="boton boton-primario boton-ancho" disabled={enviando}>
                {enviando ? "Reservando tus productos…" : error?.status === 402 ? "Generar un pedido nuevo" : "Reservar y continuar al pago"}
              </button>
              <p className="secundario">Al continuar, inventario aparta tus unidades durante 15 minutos mientras pagas.</p>
            </form>
          ) : (
            <section className="panel pila">
              <div className="reserva-activa">
                <Icono nombre="reloj" />
                <div>
                  <strong>Pedido <span className="mono">{pedido.codigo}</span> creado: tus unidades están reservadas</strong>
                  <p className="secundario">La reserva vence en <Cuenta hasta={venceEn} /> si no pagas.</p>
                </div>
              </div>
              <h2>Pago</h2>
              <FormularioPago onPagar={pagar} enviando={enviando} textoBoton={`Pagar ${pesos(pedido.total)}`} />
            </section>
          )}
        </div>

        <aside className="panel panel-destacado resumen-compra pila">
          <h2>Tu pedido</h2>
          {carrito.grupos.map((g) => (
            <div key={g.vendedorId} className="resumen-puesto">
              <FranjaToldo color={colorDeTienda(g)} />
              <div className="fila entre"><strong>{g.nombreTienda}</strong><span className="cifra">{pesos(g.subtotal)}</span></div>
              <ul className="resumen-items">
                {g.items.map((it) => <li key={it.productoId}><span>{it.cantidad} × {it.nombre}</span></li>)}
              </ul>
            </div>
          ))}
          <div className="fila entre resumen-total">
            <span>Total</span>
            <strong className="cifra">{pesos(pedido?.total ?? carrito.total)}</strong>
          </div>
        </aside>
      </div>
    </div>
  );
}
