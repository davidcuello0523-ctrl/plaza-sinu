import { useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/cliente.js";
import { hace, pesos } from "../../api/formato.js";
import { CajaError, Cargando, Sello, Vacio } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import { usePlaza } from "../../estado/plaza.jsx";
import { useCarga } from "./utiles.jsx";

export default function Resumen() {
  const { notificaciones, alNotificar } = usePlaza();
  const metricas = useCarga(() => api("/metricas/vendedor"), []);
  const stock = useCarga(() => api("/inventario").then((r) => r.datos), []);

  useEffect(() => alNotificar(() => { metricas.recargar(); stock.recargar(); }), [alNotificar, metricas.recargar, stock.recargar]);

  if (metricas.cargando) return <Cargando alto={160} filas={3} />;
  if (metricas.error) return <CajaError error={metricas.error} alReintentar={metricas.recargar} />;

  const m = metricas.datos;
  const bajos = (stock.datos || []).filter((s) => s.stockBajo);
  const recientes = notificaciones.slice(0, 5);

  return (
    <div className="bento vend-resumen">
      <Link to="/mi-puesto/pedidos" className="b-4 b-alto vend-atender">
        <span className="vend-atender-etiqueta"><Icono nombre="caja" /> Pedidos por atender</span>
        <span className="cifra vend-atender-numero">{m.porAtender}</span>
        <span>
          {m.porAtender === 0
            ? "Todo al día. Los pedidos pagados aparecerán aquí."
            : `${m.porAtender === 1 ? "Un cliente ya pagó y espera" : `${m.porAtender} clientes ya pagaron y esperan`} que prepares su pedido.`}
        </span>
        <span className="vend-atender-pie">
          <span><strong className="cifra">{m.enCamino}</strong> en camino</span>
          <span><strong className="cifra">{m.entregados ?? 0}</strong> entregados</span>
          <span className="boton boton-sm">Ver pedidos</span>
        </span>
      </Link>

      <section className="panel b-2 vend-ventas" aria-labelledby="vend-ventas">
        <h2 id="vend-ventas" className="vend-h">Ventas</h2>
        <dl>
          <div><dt>Hoy</dt><dd className="cifra">{pesos(m.ventasHoy)}</dd></div>
          <div><dt>Desde que abriste</dt><dd className="cifra">{pesos(m.ventasTotales)}</dd></div>
          {m.unidadesVendidas !== undefined && <div><dt>Unidades vendidas</dt><dd className="cifra">{m.unidadesVendidas}</dd></div>}
        </dl>
      </section>

      <section className={`panel b-2 vend-stock-bajo ${bajos.length ? "vend-alerta" : ""}`} aria-labelledby="vend-bajo">
        <div className="fila entre">
          <h2 id="vend-bajo" className="vend-h">Stock bajo</h2>
          <Link to="/mi-puesto/inventario" className="boton boton-plano boton-sm">Ajustar</Link>
        </div>
        {stock.cargando ? <Cargando alto={60} /> : bajos.length === 0 ? (
          <p className="secundario">Ningún producto está por debajo de su umbral.</p>
        ) : (
          <ul className="vend-lista">
            {bajos.slice(0, 5).map((s) => (
              <li key={s.productoId}>
                <span>{s.nombreProducto}</span>
                <Sello stock={s.estado} plano>{s.disponible === 0 ? "Agotado" : `Quedan ${s.disponible}`}</Sello>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel b-4 vend-ultimos" aria-labelledby="vend-ultimos">
        <h2 id="vend-ultimos" className="vend-h">Últimos pedidos</h2>
        {m.ultimosSubpedidos?.length ? (
          <ul className="vend-lista">
            {m.ultimosSubpedidos.slice(0, 6).map((s) => (
              <li key={s.subpedidoId}>
                <Link to={`/pedidos/${s.pedidoId}`} className="mono">{s.codigo}</Link>
                <span>{s.clienteNombre}</span>
                <span className="cifra">{pesos(s.subtotal)}</span>
                <Sello estado={s.estado} plano />
              </li>
            ))}
          </ul>
        ) : <Vacio titulo="Aún no tienes pedidos">Cuando un cliente compre en tu puesto lo verás aquí.</Vacio>}
      </section>

      <section className="panel b-2 vend-avisos" aria-labelledby="vend-avisos">
        <h2 id="vend-avisos" className="vend-h">Avisos recientes</h2>
        {recientes.length === 0 ? <p className="secundario">Sin avisos por ahora.</p> : (
          <ul className="vend-lista vend-lista-avisos">
            {recientes.map((n) => (
              <li key={n._id || n.id}>
                <strong>{n.titulo}</strong>
                <small className="secundario">{hace(n.creadoEn)}</small>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
