// Pedidos del puesto: el vendedor solo ve SUS sub-pedidos y los avanza
// PAGADO → PREPARANDO → ENVIADO → ENTREGADO (cada cambio notifica al cliente).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, urlRecurso } from "../../api/cliente.js";
import { fechaHora, pesos } from "../../api/formato.js";
import { CajaError, Cargando, Sello, Vacio } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import { usePlaza } from "../../estado/plaza.jsx";
import { useCarga } from "./utiles.jsx";

const SIGUIENTE = {
  PAGADO: ["PREPARANDO", "Empezar a preparar"],
  PREPARANDO: ["ENVIADO", "Marcar como enviado"],
  ENVIADO: ["ENTREGADO", "Marcar como entregado"],
};
const FILTROS = [
  ["PAGADO", "Por atender"], ["PREPARANDO", "Preparando"], ["ENVIADO", "En camino"], ["ENTREGADO", "Entregados"], ["TODOS", "Todos"],
];

export default function Pedidos() {
  const { avisar, alNotificar } = usePlaza();
  // shortcut: trae los 50 pedidos más recientes y filtra por estado del sub-pedido en el navegador; paginar si un puesto supera ese volumen
  const { datos, cargando, error, recargar } = useCarga(() => api("/pedidos?porPagina=50").then((r) => r.datos), []);
  const [filtro, setFiltro] = useState("PAGADO");
  const [avanzando, setAvanzando] = useState(null);

  useEffect(() => alNotificar(recargar), [alNotificar, recargar]);

  if (cargando) return <Cargando alto={120} filas={3} />;
  if (error) return <CajaError error={error} alReintentar={recargar} />;

  const subpedidos = datos.flatMap((p) => (p.subpedidos || []).map((s) => ({ ...s, pedido: p })));
  const conteo = (estado) => subpedidos.filter((s) => estado === "TODOS" || s.estado === estado).length;
  const visibles = subpedidos.filter((s) => filtro === "TODOS" || s.estado === filtro);

  async function avanzar(s) {
    const [estado, accion] = SIGUIENTE[s.estado];
    setAvanzando(s.id);
    try {
      await api(`/pedidos/${s.pedido.id}/estado`, { metodo: "PATCH", cuerpo: { subpedidoId: s.id, estado } });
      avisar(`${s.pedido.codigo}: ${accion.toLowerCase()} listo. El cliente fue notificado.`, "exito");
      await recargar();
    } catch (err) {
      avisar(err.message, "error");
    } finally {
      setAvanzando(null);
    }
  }

  return (
    <div className="pila" style={{ "--pila": "20px" }}>
      <div className="fila entre">
        <h2>Pedidos</h2>
        <div className="vend-chips" role="group" aria-label="Filtrar por estado">
          {FILTROS.map(([estado, texto]) => (
            <button key={estado} className={`vend-chip ${filtro === estado ? "activo" : ""}`} aria-pressed={filtro === estado} onClick={() => setFiltro(estado)}>
              {texto} <span className="cifra">{conteo(estado)}</span>
            </button>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <Vacio icono="camion" titulo={filtro === "PAGADO" ? "No hay pedidos por atender" : "No hay pedidos en este estado"}>
          {filtro === "PAGADO" && "Cuando un cliente pague, el pedido aparece aquí y te llega un aviso en la campana."}
        </Vacio>
      ) : (
        <ul className="vend-pedidos">
          {visibles.map((s) => (
            <li key={s.id} className="panel vend-pedido">
              <div className="fila entre">
                <span className="fila" style={{ gap: 10 }}>
                  <Link to={`/pedidos/${s.pedido.id}`} className="mono vend-codigo">{s.pedido.codigo}</Link>
                  <Sello estado={s.estado} />
                </span>
                <small className="secundario">{fechaHora(s.pedido.creadoEn)}</small>
              </div>
              <div className="vend-pedido-cuerpo">
                <div>
                  <strong>{s.pedido.clienteNombre}</strong>
                  <p className="secundario">
                    <Icono nombre="ubicacion" tamano={16} className="vend-icono-linea" />
                    {s.pedido.direccion?.direccion}, {s.pedido.direccion?.ciudad}
                  </p>
                </div>
                <ul className="vend-items">
                  {s.items?.map((i) => (
                    <li key={i.id}>
                      <img src={urlRecurso(i.imagen)} alt="" width="40" height="40" loading="lazy" />
                      <span>{i.cantidad} × {i.nombre}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="fila entre vend-pedido-pie">
                <span><span className="secundario">Subtotal </span><span className="cifra">{pesos(s.subtotal)}</span></span>
                {SIGUIENTE[s.estado] ? (
                  <button className="boton boton-primario boton-sm" disabled={avanzando === s.id} onClick={() => avanzar(s)}>
                    {avanzando === s.id ? "Guardando…" : SIGUIENTE[s.estado][1]}
                  </button>
                ) : <Link to={`/pedidos/${s.pedido.id}`} className="boton boton-plano boton-sm">Ver traza</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
