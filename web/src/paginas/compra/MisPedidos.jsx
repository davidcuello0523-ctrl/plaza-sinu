import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/cliente.js";
import { ESTADOS_PEDIDO, fechaHora, pesos } from "../../api/formato.js";
import { CajaError, Cargando, Sello, Vacio } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import { useSesion } from "../../estado/sesion.jsx";
import "../../estilos/compra.css";

const FILTROS = ["PENDIENTE_PAGO", "PAGADO", "COMPLETADO", "PAGO_RECHAZADO", "RECHAZADO_SIN_STOCK", "CANCELADO"];

export default function MisPedidos() {
  const { rol } = useSesion();
  const [estado, setEstado] = useState("");
  const [pagina, setPagina] = useState(1);
  const [respuesta, setRespuesta] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    const q = new URLSearchParams({ pagina, porPagina: 10, ...(estado && { estado }) });
    try { setRespuesta(await api(`/pedidos?${q}`)); } catch (e) { setError(e); }
  }, [estado, pagina]);

  useEffect(() => { cargar(); }, [cargar]);

  const elegir = (e) => { setEstado(e); setPagina(1); setRespuesta(null); };

  return (
    <div className="contenedor pagina">
      <h1>{rol === "cliente" ? "Mis pedidos" : "Pedidos"}</h1>
      <p className="secundario" style={{ marginTop: 6 }}>
        {rol === "vendedor" ? "Solo ves la parte de cada pedido que le corresponde a tu puesto." : "Toca un pedido para ver su recorrido por los servicios."}
      </p>

      <div className="chips-estado" role="group" aria-label="Filtrar por estado">
        <button className={`chip-estado ${estado === "" ? "activo" : ""}`} aria-pressed={estado === ""} onClick={() => elegir("")}>Todos</button>
        {FILTROS.map((f) => (
          <button key={f} className={`chip-estado ${estado === f ? "activo" : ""}`} aria-pressed={estado === f} onClick={() => elegir(f)}>
            {ESTADOS_PEDIDO[f].texto}
          </button>
        ))}
      </div>

      {error && <CajaError error={error} alReintentar={cargar} />}
      {!respuesta && !error && <Cargando alto={110} filas={3} />}
      {respuesta?.datos.length === 0 && (
        <Vacio icono="caja" titulo={estado ? "No hay pedidos en este estado" : "Aún no tienes pedidos"}
          accion={rol === "cliente" && !estado && <Link to="/catalogo" className="boton boton-primario">Recorrer la plaza</Link>}>
          {estado ? "Prueba con otro filtro." : "Cuando compres, aquí verás cada pedido y su traza."}
        </Vacio>
      )}

      {respuesta?.datos.length > 0 && (
        <ul className="lista-pedidos">
          {respuesta.datos.map((p) => (
            <li key={p.id}>
              <Link to={`/pedidos/${p.id}`} className="tarjeta-pedido">
                <div className="tarjeta-pedido-cabeza">
                  <span className="mono codigo">{p.codigo}</span>
                  <Sello estado={p.estado} />
                </div>
                <div className="tarjeta-pedido-cuerpo">
                  <div>
                    <span className="secundario">{fechaHora(p.creadoEn)}</span>
                    {rol !== "cliente" && <span className="secundario"> · {p.clienteNombre}</span>}
                  </div>
                  <ul className="subpedidos-mini">
                    {p.subpedidos.map((s) => (
                      <li key={s.id}>
                        <Icono nombre="puesto" tamano={16} /> {s.nombreTienda}
                        <span className="secundario">{s.unidades} ud{s.unidades === 1 ? "" : "s"}</span>
                        <Sello estado={s.estado} plano />
                      </li>
                    ))}
                  </ul>
                </div>
                <strong className="cifra tarjeta-pedido-total">{pesos(rol === "vendedor" ? p.subpedidos.reduce((a, s) => a + s.subtotal, 0) : p.total)}</strong>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {respuesta?.totalPaginas > 1 && (
        <nav className="fila paginacion-pedidos" aria-label="Paginación">
          <button className="boton boton-sm" disabled={pagina <= 1} onClick={() => setPagina((x) => x - 1)}>
            <Icono nombre="atras" tamano={16} /> Anterior
          </button>
          <span className="secundario">Página {respuesta.pagina} de {respuesta.totalPaginas}</span>
          <button className="boton boton-sm" disabled={pagina >= respuesta.totalPaginas} onClick={() => setPagina((x) => x + 1)}>
            Siguiente <Icono nombre="adelante" tamano={16} />
          </button>
        </nav>
      )}
    </div>
  );
}
