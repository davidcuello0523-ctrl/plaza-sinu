// Métricas del marketplace (GET /metricas de pedidos-pagos). Gráficas en SVG propio.
import { useEffect, useState } from "react";
import { api } from "../../api/cliente.js";
import { ESTADOS_PEDIDO, pesos } from "../../api/formato.js";
import { CajaError, Cargando, Sello, Vacio } from "../../componentes/comunes.jsx";

// Colores de cada puesto (docs/contratos.md §5); las métricas solo traen el nombre.
const COLOR_PUESTO = {
  "Tecno Sinú": "#1F6FB2", "Rueda Libre": "#2F8F5B", "Hilo & Río": "#B0457A", "Casa Ronda": "#8A5A2B",
  "Taller Zenú": "#C98A12", "Papelería El Lápiz": "#3D6B7A", "Deportes Ribera": "#C23B3B", "Mercadito Tierralta": "#6B7A2E",
};
const PALETA = ["#E4572E", "#16324F", "#2F8F5B", "#C98A12", "#B0457A", "#8A5A2B", "#3D6B7A"];
const NOMBRE_CATEGORIA = {
  tecnologia: "Tecnología", bicicletas: "Bicicletas y accesorios", ropa: "Ropa", hogar: "Hogar",
  artesanias: "Artesanías", papeleria: "Papelería", deportes: "Deportes",
};
const millones = (v) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("es-CO", { maximumFractionDigits: 1 })} M` : pesos(v));

function VentasPorDia({ dias }) {
  const W = 600, H = 200, P = { i: 44, d: 10, a: 14, b: 28 };
  const max = Math.max(...dias.map((d) => d.total), 1);
  const px = (i) => P.i + (i * (W - P.i - P.d)) / Math.max(dias.length - 1, 1);
  const py = (v) => H - P.b - (v / max) * (H - P.a - P.b);
  const linea = dias.map((d, i) => `${i ? "L" : "M"}${px(i)} ${py(d.total)}`).join(" ");
  const area = `${linea} L${px(dias.length - 1)} ${H - P.b} L${px(0)} ${H - P.b}Z`;
  const total = dias.reduce((s, d) => s + d.total, 0);
  return (
    <svg className="grafica-dias" viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="t-dias d-dias">
      <title id="t-dias">Ventas por día, últimos {dias.length} días</title>
      <desc id="d-dias">Total del periodo {pesos(total)}. Día con más ventas: {pesos(max)}.</desc>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line className="eje" x1={P.i} x2={W - P.d} y1={py(max * f)} y2={py(max * f)} />
          <text x={P.i - 6} y={py(max * f) + 4} textAnchor="end">{f ? millones(max * f) : "0"}</text>
        </g>
      ))}
      <path className="area" d={area} />
      <path className="linea" d={linea} />
      {dias.map((d, i) => (
        <g key={d.fecha}>
          {d.total > 0 && <circle className="punto" cx={px(i)} cy={py(d.total)} r="4"><title>{`${d.fecha}: ${pesos(d.total)}, ${d.pedidos} pedido(s)`}</title></circle>}
          {(dias.length - 1 - i) % 2 === 0 && <text x={px(i)} y={H - 8} textAnchor="middle">{Number(d.fecha.slice(8))}</text>}
        </g>
      ))}
    </svg>
  );
}

export default function Metricas() {
  const [m, setM] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api("/metricas").then(setM).catch(setError); }, []);

  if (error) return <CajaError error={error} />;
  if (!m) return <Cargando alto={180} filas={2} />;

  const maxVendedor = Math.max(...m.ventasPorVendedor.map((v) => v.total), 1);
  const totalCategorias = m.ventasPorCategoria.reduce((s, c) => s + c.total, 0) || 1;
  const unidades = m.ventasPorVendedor.reduce((s, v) => s + v.unidades, 0);
  const estados = Object.entries(m.pedidosPorEstado).sort((a, b) => b[1] - a[1]);

  return (
    <div className="pila" style={{ "--pila": "20px" }}>
      <div>
        <h2>Métricas de la plaza</h2>
        <p className="secundario">Solo cuentan como venta los pedidos pagados. Calculado por el servicio pedidos-pagos.</p>
      </div>
      <div className="bento">
        <section className="panel panel-destacado metrica-total">
          <h3>Ventas pagadas</h3>
          <span className="cifra">{pesos(m.ventasTotales)}</span>
          <p className="secundario">{unidades} unidades vendidas en {m.pedidosTotales} pedidos registrados.</p>
        </section>

        <section className="panel b-4">
          <h3>Ventas por puesto</h3>
          {m.ventasPorVendedor.length === 0 ? <Vacio titulo="Aún no hay ventas" /> : (
            <ul className="barras-vendedor">
              {m.ventasPorVendedor.map((v, i) => (
                <li key={v.nombreTienda}>
                  <div className="fila entre"><strong>{v.nombreTienda}</strong><span className="cifra">{pesos(v.total)}</span></div>
                  <div className="barra-fondo" role="img" aria-label={`${v.nombreTienda}: ${pesos(v.total)}, ${v.unidades} unidades`}>
                    <div className="barra-valor" style={{ width: `${(v.total / maxVendedor) * 100}%`, background: COLOR_PUESTO[v.nombreTienda] || PALETA[i % PALETA.length] }} />
                  </div>
                  <small className="secundario">{v.unidades} unidades</small>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel b-3">
          <h3>Ventas por categoría</h3>
          <div className="franja-categorias" role="img" aria-label="Proporción de ventas por categoría">
            {m.ventasPorCategoria.map((c, i) => (
              <span key={c.categoria} style={{ flexGrow: c.total, background: PALETA[i % PALETA.length] }} title={`${NOMBRE_CATEGORIA[c.categoria] || c.categoria}: ${pesos(c.total)}`} />
            ))}
          </div>
          <ul className="leyenda-categorias">
            {m.ventasPorCategoria.map((c, i) => (
              <li key={c.categoria}>
                <i style={{ background: PALETA[i % PALETA.length] }} aria-hidden="true" />
                <span>{NOMBRE_CATEGORIA[c.categoria] || c.categoria}</span>
                <span className="cifra">{Math.round((c.total / totalCategorias) * 100)} %</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel b-3">
          <h3>Ventas por día</h3>
          <VentasPorDia dias={m.ventasPorDia} />
        </section>

        <section className="panel b-6">
          <h3>Pedidos por estado</h3>
          <ul className="estados-pedido" style={{ padding: 0 }}>
            {estados.map(([e, n]) => (
              <li key={e}><Sello estado={e}>{ESTADOS_PEDIDO[e]?.texto || e}</Sello><span className="cifra">{n}</span></li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
