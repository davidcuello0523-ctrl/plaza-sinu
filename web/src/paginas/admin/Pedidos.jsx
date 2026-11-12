// Todos los pedidos del marketplace (admin), con su traza a un clic.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/cliente.js";
import { ESTADOS_PEDIDO, fechaHora, pesos } from "../../api/formato.js";
import { CajaError, Cargando, Sello, Vacio } from "../../componentes/comunes.jsx";

const FILTROS = ["", "PENDIENTE_PAGO", "PAGADO", "COMPLETADO", "PAGO_RECHAZADO", "RECHAZADO_SIN_STOCK", "CANCELADO"];

export default function Pedidos() {
  const [estado, setEstado] = useState("");
  const [pagina, setPagina] = useState(1);
  const [respuesta, setRespuesta] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setRespuesta(null);
    setError(null);
    api(`/pedidos?pagina=${pagina}&porPagina=15${estado ? `&estado=${estado}` : ""}`).then(setRespuesta).catch(setError);
  }, [estado, pagina]);

  return (
    <div className="pila" style={{ "--pila": "20px" }}>
      <div>
        <h2>Pedidos</h2>
        <p className="secundario">Todos los pedidos de la plaza. Abre uno para ver su traza: qué servicio hizo cada paso y si fue por REST o por evento.</p>
      </div>
      <label className="campo" style={{ maxWidth: 320 }}>
        <span>Estado</span>
        <select className="selector" value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }}>
          {FILTROS.map((f) => <option key={f} value={f}>{f ? ESTADOS_PEDIDO[f].texto : "Todos los estados"}</option>)}
        </select>
      </label>
      <CajaError error={error} />
      {error ? null : !respuesta ? <Cargando alto={300} /> : respuesta.datos.length === 0 ? (
        <div className="panel"><Vacio icono="caja" titulo="No hay pedidos con ese estado" /></div>
      ) : (
        <>
          <div className="tabla-envoltura">
            <table className="tabla">
              <thead><tr><th>Código</th><th>Cliente</th><th>Puestos</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
              <tbody>
                {respuesta.datos.map((p) => (
                  <tr key={p.id}>
                    <td><Link to={`/pedidos/${p.id}`} className="mono enlace-codigo">{p.codigo}</Link></td>
                    <td>{p.clienteNombre}</td>
                    <td className="secundario">{(p.subpedidos || []).map((s) => s.nombreTienda).join(", ")}</td>
                    <td className="cifra">{pesos(p.total)}</td>
                    <td><Sello estado={p.estado} plano /></td>
                    <td className="secundario">{fechaHora(p.creadoEn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="fila entre" aria-label="Paginación">
            <span className="secundario">Página {respuesta.pagina} de {respuesta.totalPaginas}, {respuesta.total} pedidos</span>
            <div className="fila">
              <button className="boton boton-sm" disabled={pagina <= 1} onClick={() => setPagina((n) => n - 1)}>Anterior</button>
              <button className="boton boton-sm" disabled={pagina >= respuesta.totalPaginas} onClick={() => setPagina((n) => n + 1)}>Siguiente</button>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
