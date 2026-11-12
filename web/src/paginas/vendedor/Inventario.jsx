// Inventario del puesto: stock físico, reservado y disponible; ajuste y kardex.
import { useEffect, useState } from "react";
import { api } from "../../api/cliente.js";
import { fechaHora } from "../../api/formato.js";
import { CajaError, Cargando, Sello, Vacio } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import { usePlaza } from "../../estado/plaza.jsx";
import { Dialogo, erroresPorCampo, useCarga } from "./utiles.jsx";

const TIPOS = {
  ENTRADA: ["exito", "Entrada"], SALIDA: ["rio", "Venta"], AJUSTE: ["aviso", "Ajuste"],
  RESERVA: ["neutro", "Reserva"], LIBERACION: ["neutro", "Liberación"],
};

function FilaAjuste({ stock, alGuardar, alCancelar }) {
  const [fisico, setFisico] = useState(String(stock.fisico));
  const [umbral, setUmbral] = useState(String(stock.umbral));
  const [nota, setNota] = useState("");
  const [error, setError] = useState(null);
  const campos = erroresPorCampo(error);

  async function guardar(e) {
    e.preventDefault();
    try {
      await api(`/inventario/${stock.productoId}`, {
        metodo: "PUT", cuerpo: { fisico: Number(fisico), umbral: Number(umbral), ...(nota.trim() && { nota: nota.trim() }) },
      });
      alGuardar();
    } catch (err) { setError(err); }
  }

  return (
    <tr className="vend-fila-ajuste">
      <td colSpan={7}>
        <form className="vend-ajuste" onSubmit={guardar}>
          <strong>Ajustar {stock.nombreProducto}</strong>
          <label className="campo"><span>Unidades físicas</span>
            <input className="entrada" type="number" min={stock.reservado} step="1" value={fisico} onChange={(e) => setFisico(e.target.value)} autoFocus />
            {campos.fisico && <small className="mensaje-error">{campos.fisico}</small>}
          </label>
          <label className="campo"><span>Avisar con</span>
            <input className="entrada" type="number" min="0" step="1" value={umbral} onChange={(e) => setUmbral(e.target.value)} />
          </label>
          <label className="campo vend-ajuste-nota"><span>Nota (opcional)</span>
            <input className="entrada" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Llegó pedido del proveedor" />
          </label>
          <span className="fila">
            <button type="button" className="boton boton-plano boton-sm" onClick={alCancelar}>Cancelar</button>
            <button className="boton boton-primario boton-sm">Guardar</button>
          </span>
          {error && !campos.fisico && <div style={{ gridColumn: "1 / -1" }}><CajaError error={error} /></div>}
          {stock.reservado > 0 && <small className="secundario" style={{ gridColumn: "1 / -1" }}>Hay {stock.reservado} unidades reservadas por pedidos sin pagar: no puedes bajar de esa cantidad.</small>}
        </form>
      </td>
    </tr>
  );
}

function Kardex({ stock }) {
  const { datos, cargando, error } = useCarga(() => api(`/inventario/${stock.productoId}/movimientos`).then((r) => r.datos), [stock.productoId]);
  if (cargando) return <Cargando alto={48} filas={4} />;
  if (error) return <CajaError error={error} />;
  if (!datos.length) return <Vacio titulo="Sin movimientos todavía" />;
  return (
    <ol className="vend-kardex">
      {datos.map((m) => {
        const [tono, texto] = TIPOS[m.tipo] || ["neutro", m.tipo];
        return (
          <li key={m.id}>
            <div className="fila entre">
              <Sello tono={tono} plano>{texto}</Sello>
              <small className="secundario">{fechaHora(m.creadoEn)}</small>
            </div>
            <div className="fila entre">
              <span className="cifra">{["SALIDA", "RESERVA"].includes(m.tipo) ? "−" : m.tipo === "AJUSTE" ? "=" : "+"}{m.cantidad} uds</span>
              <span className="secundario">Físico {m.saldoFisico}, disponible {m.saldoDisponible}</span>
            </div>
            {(m.nota || m.referencia) && (
              <p className="secundario">{m.nota}{m.referencia && <span className="mono"> {m.referencia.slice(0, 8)}</span>}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function Inventario() {
  const { avisar, alNotificar } = usePlaza();
  const { datos, cargando, error, recargar } = useCarga(() => api("/inventario").then((r) => r.datos), []);
  const [ajustando, setAjustando] = useState(null);
  const [kardex, setKardex] = useState(null);
  const [soloBajos, setSoloBajos] = useState(false);

  useEffect(() => alNotificar(recargar), [alNotificar, recargar]);

  if (cargando) return <Cargando alto={56} filas={6} />;
  if (error) return <CajaError error={error} alReintentar={recargar} />;

  const bajos = datos.filter((s) => s.stockBajo).length;
  const filas = soloBajos ? datos.filter((s) => s.stockBajo) : datos;

  return (
    <div className="pila" style={{ "--pila": "20px" }}>
      <div className="fila entre">
        <div>
          <h2>Inventario</h2>
          <p className="secundario">Disponible = físico − reservado. Las reservas vencen a los 15 minutos si el cliente no paga.</p>
        </div>
        <button className={`boton boton-sm ${soloBajos ? "boton-rio" : ""}`} aria-pressed={soloBajos} onClick={() => setSoloBajos((v) => !v)}>
          <Icono nombre="alerta" tamano={18} /> Stock bajo ({bajos})
        </button>
      </div>
      {filas.length === 0 ? <Vacio titulo="Nada por aquí">No hay productos con stock bajo.</Vacio> : (
        <div className="tabla-envoltura">
          <table className="tabla vend-tabla-stock">
            <thead>
              <tr><th>Producto</th><th>Físico</th><th>Reservado</th><th>Disponible</th><th>Avisar con</th><th>Estado</th><th><span className="solo-lectores">Acciones</span></th></tr>
            </thead>
            <tbody>
              {filas.map((s) => (
                ajustando === s.productoId ? (
                  <FilaAjuste key={s.productoId} stock={s} alCancelar={() => setAjustando(null)}
                    alGuardar={() => { setAjustando(null); avisar(`Stock de ${s.nombreProducto} actualizado`, "exito"); recargar(); }} />
                ) : (
                  <tr key={s.productoId} className={s.stockBajo ? "vend-fila-baja" : ""}>
                    <td><strong>{s.nombreProducto}</strong><br /><span className="mono secundario">{s.productoId}</span></td>
                    <td className="cifra">{s.fisico}</td>
                    <td className="cifra">{s.reservado}</td>
                    <td className="cifra">{s.disponible}</td>
                    <td className="cifra">{s.umbral}</td>
                    <td><Sello stock={s.estado} plano /></td>
                    <td>
                      <span className="fila" style={{ gap: 4, flexWrap: "nowrap" }}>
                        <button className="boton boton-sm" onClick={() => setAjustando(s.productoId)}>Ajustar</button>
                        <button className="boton boton-plano boton-sm" onClick={() => setKardex(s)}>Kardex</button>
                      </span>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Dialogo abierto={!!kardex} alCerrar={() => setKardex(null)} titulo={kardex ? `Kardex de ${kardex.nombreProducto}` : ""} lateral ancho={440}>
        {kardex && <Kardex stock={kardex} />}
      </Dialogo>
    </div>
  );
}
