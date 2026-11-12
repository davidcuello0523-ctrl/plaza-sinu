// Carrito agrupado por puesto. Al abrirlo, el servicio carrito vuelve a validar
// precios (catálogo) y stock (inventario) y devuelve los avisos.
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, urlRecurso } from "../../api/cliente.js";
import { pesos } from "../../api/formato.js";
import { CajaError, Cargando, Sello, Vacio } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import { usePlaza } from "../../estado/plaza.jsx";
import { colorDeTienda, FranjaToldo } from "./compartidos.jsx";
import "../../estilos/compra.css";

export default function Carrito() {
  const { setCarrito, avisar } = usePlaza();
  const [carrito, setLocal] = useState(null);
  const [error, setError] = useState(null);
  const [ocupado, setOcupado] = useState(null); // productoId que se está actualizando

  const aplicar = useCallback((c) => { setLocal(c); setCarrito(c); }, [setCarrito]);

  const cargar = useCallback(async () => {
    setError(null);
    try { aplicar(await api("/carrito")); } catch (e) { setError(e); }
  }, [aplicar]);

  useEffect(() => { cargar(); }, [cargar]);

  async function cambiar(productoId, accion) {
    setOcupado(productoId);
    try {
      aplicar(await accion());
    } catch (e) {
      avisar(e.message, "error");
    } finally {
      setOcupado(null);
    }
  }
  const fijarCantidad = (id, cantidad) =>
    cambiar(id, () => api(`/carrito/items/${id}`, { metodo: "PATCH", cuerpo: { cantidad } }));
  const quitar = (id) => cambiar(id, () => api(`/carrito/items/${id}`, { metodo: "DELETE" }));

  if (error) return <div className="contenedor pagina"><CajaError error={error} alReintentar={cargar} /></div>;
  if (!carrito) return <div className="contenedor pagina"><Cargando alto={140} filas={3} /></div>;

  if (carrito.grupos.length === 0) {
    return (
      <div className="contenedor pagina">
        <Vacio icono="carrito" titulo="Tu carrito está vacío"
          accion={<Link to="/catalogo" className="boton boton-primario">Recorrer la plaza</Link>}>
          Puedes llevar productos de varios puestos en una sola compra.
        </Vacio>
      </div>
    );
  }

  return (
    <div className="contenedor pagina">
      <div className="fila entre" style={{ marginBottom: 24 }}>
        <div>
          <h1>Tu carrito</h1>
          <p className="secundario" style={{ marginTop: 6 }}>
            {carrito.unidades} {carrito.unidades === 1 ? "unidad" : "unidades"} de {carrito.grupos.length} {carrito.grupos.length === 1 ? "puesto" : "puestos"}
          </p>
        </div>
      </div>

      <div className="compra-columnas">
        <div className="pila" style={{ "--pila": "24px" }}>
          {carrito.avisos?.length > 0 && (
            <div className="caja-aviso" role="status">
              <ul className="lista-avisos">{carrito.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
          )}

          {carrito.grupos.map((g) => (
            <section key={g.vendedorId} className="grupo-puesto" aria-label={`Productos de ${g.nombreTienda}`}>
              <FranjaToldo color={colorDeTienda(g)} />
              <div className="grupo-cabeza fila entre">
                <h2 className="grupo-titulo"><Icono nombre="puesto" /> {g.nombreTienda}</h2>
                <span className="secundario">{g.unidades} {g.unidades === 1 ? "unidad" : "unidades"}</span>
              </div>
              <ul className="items-carrito">
                {g.items.map((it) => (
                  <li key={it.productoId} className="item-carrito" aria-busy={ocupado === it.productoId}>
                    <Link to={`/productos/${it.productoId}`} className="item-imagen">
                      <img src={urlRecurso(it.imagen)} alt="" loading="lazy" />
                    </Link>
                    <div className="item-info">
                      <Link to={`/productos/${it.productoId}`} className="item-nombre">{it.nombre}</Link>
                      <div className="fila">
                        <span className="cifra">{pesos(it.precio)}</span>
                        {it.estadoStock && it.estadoStock !== "disponible" && <Sello stock={it.estadoStock} plano />}
                      </div>
                      {it.avisos?.map((a) => <p key={a} className="item-aviso"><Icono nombre="alerta" tamano={16} /> {a}</p>)}
                    </div>
                    <div className="item-acciones">
                      <div className="paso-cantidad" role="group" aria-label={`Cantidad de ${it.nombre}`}>
                        <button className="boton boton-plano boton-icono" disabled={ocupado === it.productoId || it.cantidad <= 1}
                          onClick={() => fijarCantidad(it.productoId, it.cantidad - 1)} aria-label="Quitar una unidad">
                          <Icono nombre="menos" tamano={18} />
                        </button>
                        <span className="cifra" aria-live="polite">{it.cantidad}</span>
                        <button className="boton boton-plano boton-icono" disabled={ocupado === it.productoId}
                          onClick={() => fijarCantidad(it.productoId, it.cantidad + 1)} aria-label="Agregar una unidad">
                          <Icono nombre="mas" tamano={18} />
                        </button>
                      </div>
                      <span className="cifra item-subtotal">{pesos(it.subtotal)}</span>
                      <button className="boton boton-plano boton-sm" disabled={ocupado === it.productoId} onClick={() => quitar(it.productoId)}>
                        <Icono nombre="basura" tamano={16} /> Quitar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="grupo-subtotal fila entre">
                <span>Subtotal de {g.nombreTienda}</span>
                <strong className="cifra">{pesos(g.subtotal)}</strong>
              </div>
            </section>
          ))}
        </div>

        <aside className="panel panel-destacado resumen-compra pila">
          <h2>Resumen</h2>
          {carrito.grupos.map((g) => (
            <div key={g.vendedorId} className="fila entre resumen-linea">
              <span>{g.nombreTienda}</span>
              <span className="cifra">{pesos(g.subtotal)}</span>
            </div>
          ))}
          <div className="fila entre resumen-total">
            <span>Total</span>
            <strong className="cifra">{pesos(carrito.total)}</strong>
          </div>
          <p className="secundario">El envío lo coordina cada puesto. Las unidades se reservan al generar el pedido.</p>
          {carrito.valido ? (
            <Link to="/checkout" className="boton boton-primario boton-ancho">Continuar con la compra</Link>
          ) : (
            <>
              <button className="boton boton-primario boton-ancho" disabled>Continuar con la compra</button>
              <p className="mensaje-error">Ajusta las cantidades marcadas o quita los productos sin stock para continuar.</p>
            </>
          )}
          <Link to="/catalogo" className="boton boton-plano boton-ancho">Seguir comprando</Link>
        </aside>
      </div>
    </div>
  );
}
