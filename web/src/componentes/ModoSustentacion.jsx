// Modo sustentación: panel flotante con los 7 pasos del flujo obligatorio que
// se marcan SOLOS al llegar los sucesos del gateway (eventos RabbitMQ + pasos REST).
// Visible para el admin o con ?demo=1 en la URL.
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { hora } from "../api/formato.js";
import { useSesion } from "../estado/sesion.jsx";
import { useSucesos } from "../paginas/admin/monitor.js";
import Icono from "./Icono.jsx";
import "../estilos/admin.css"; // el panel aparece en cualquier página, no solo en la sala

const PASOS = [
  { titulo: "Iniciar sesión", servicio: "usuarios emite el JWT", tipos: ["http.sesion_iniciada"] },
  { titulo: "Consultar productos", servicio: "catálogo responde por el gateway", tipos: ["http.productos_consultados"] },
  { titulo: "Agregar al carrito", servicio: "carrito valida precio y stock", tipos: ["http.carrito_agregado"] },
  { titulo: "Generar pedido", servicio: "pedidos-pagos crea el pedido y reserva", tipos: ["http.pedido_generado", "pedido.creado"] },
  { titulo: "Actualizar inventario", servicio: "inventario confirma el descuento", tipos: ["reserva.confirmada", "inventario.actualizado"] },
  { titulo: "Registrar pago", servicio: "pasarela simulada aprueba", tipos: ["pago.aprobado"] },
  { titulo: "Generar notificación", servicio: "notificaciones avisa por SSE", tipos: ["notificacion.enviada"] },
];

function leerBandera(search) {
  try {
    if (new URLSearchParams(search).get("demo") === "1") sessionStorage.setItem("plaza.demo", "1");
    return sessionStorage.getItem("plaza.demo") === "1";
  } catch {
    return new URLSearchParams(search).get("demo") === "1";
  }
}

export default function ModoSustentacion() {
  const { rol } = useSesion();
  const { search } = useLocation();
  const [bandera, setBandera] = useState(() => leerBandera(search));
  const [abierto, setAbierto] = useState(false);
  const [hechos, setHechos] = useState({}); // índice de paso → { ocurridoEn, correlationId }

  useEffect(() => { setBandera(leerBandera(search)); }, [search]);
  const esAdmin = rol === "admin";

  const alSuceso = useCallback((s) => {
    const i = PASOS.findIndex((p) => p.tipos.includes(s.tipo));
    if (i >= 0) setHechos((h) => (h[i] ? h : { ...h, [i]: { ocurridoEn: s.ocurridoEn, correlationId: s.correlationId } }));
  }, []);
  useSucesos(alSuceso, esAdmin);

  if (!esAdmin && !bandera) return null;
  const completados = Object.keys(hechos).length;

  return (
    <>
      <button className="demo-boton" aria-expanded={abierto} aria-controls="panel-demo" onClick={() => setAbierto((v) => !v)}>
        <Icono nombre="presentacion" tamano={18} />
        Modo sustentación <b>{completados}/7</b>
      </button>
      {abierto && (
        <aside id="panel-demo" className="demo-panel" aria-label="Flujo obligatorio de la demostración">
          <div className="demo-cabeza">
            <strong>Flujo obligatorio</strong>
            <p>Cada paso se marca solo cuando el sistema lo registra. Compra desde otra ventana con la cuenta de cliente.</p>
          </div>
          {!esAdmin ? (
            <p className="caja-aviso" style={{ margin: 16 }}>
              Para que los pasos se marquen solos, abre esta vista con la cuenta admin (admin@plazasinu.co) en otra ventana: el radar de eventos es solo para administradores.
            </p>
          ) : (
            <ol className="demo-pasos" aria-live="polite">
              {PASOS.map((p, i) => {
                const h = hechos[i];
                return (
                  <li key={p.titulo} className={h ? "demo-hecho" : ""}>
                    <span className="demo-marca" aria-hidden="true">{h ? <Icono nombre="check" tamano={16} /> : i + 1}</span>
                    <div>
                      <strong>{p.titulo}</strong>
                      <span className="solo-lectores">{h ? ", completado" : ", pendiente"}</span>
                      <div className="demo-detalle">{p.servicio}</div>
                      {h && <div className="demo-detalle"><span className="mono">{hora(h.ocurridoEn)}</span> · <span className="mono">{h.correlationId?.slice(0, 8)}</span></div>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          <div className="demo-pie fila entre">
            <span className="secundario">{completados === 7 ? "Flujo completo" : `${completados} de 7 pasos`}</span>
            <button className="boton boton-sm" onClick={() => setHechos({})}>Reiniciar</button>
          </div>
        </aside>
      )}
    </>
  );
}
