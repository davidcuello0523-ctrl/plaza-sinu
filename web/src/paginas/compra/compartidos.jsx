// Piezas propias del flujo de compra: franja de toldo por puesto y formulario de pago.
import { useState } from "react";
import Icono from "../../componentes/Icono.jsx";

const PALETA = ["#1F6FB2", "#2F8F5B", "#B0457A", "#8A5A2B", "#C98A12", "#3D6B7A", "#C23B3B", "#6B7A2E"];

// Color estable por nombre de tienda cuando el servicio no manda colorTienda.
export function colorDeTienda(grupo) {
  if (grupo?.colorTienda) return grupo.colorTienda;
  const nombre = grupo?.nombreTienda || "";
  let h = 0;
  for (const c of nombre) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

export function FranjaToldo({ color }) {
  return <div className="toldo toldo-mini" style={{ "--color-toldo": color }} aria-hidden="true" />;
}

const TARJETAS_PRUEBA = [
  { numero: "4242 4242 4242 4242", texto: "aprueba el pago", tono: "exito" },
  { numero: "4000 0000 0000 0002", texto: "rechaza el pago (fondos insuficientes)", tono: "error" },
];

const espaciar = (v) => v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
const vencimiento = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

// Formulario de tarjeta. Nunca guarda nada: solo entrega los datos a onPagar.
export function FormularioPago({ onPagar, enviando, textoBoton = "Pagar" }) {
  const [tarjeta, setTarjeta] = useState({ numeroTarjeta: "", titular: "", vencimiento: "", cvv: "" });
  const cambiar = (campo, valor) => setTarjeta((t) => ({ ...t, [campo]: valor }));
  const completo = tarjeta.numeroTarjeta.replace(/\s/g, "").length === 16 && tarjeta.titular.trim().length > 2
    && /^\d{2}\/\d{2}$/.test(tarjeta.vencimiento) && /^\d{3,4}$/.test(tarjeta.cvv);

  return (
    <form className="pila" onSubmit={(e) => { e.preventDefault(); if (completo) onPagar({ ...tarjeta, numeroTarjeta: tarjeta.numeroTarjeta.replace(/\s/g, "") }); }}>
      <div className="tarjetas-prueba">
        <strong><Icono nombre="tarjeta" tamano={18} /> Tarjetas de prueba</strong>
        <p className="secundario">Esta es una pasarela simulada: no se cobra nada. Toca una tarjeta para llenarla.</p>
        <div className="fila">
          {TARJETAS_PRUEBA.map((t) => (
            <button key={t.numero} type="button" className={`tarjeta-prueba tarjeta-${t.tono}`}
              onClick={() => setTarjeta({ numeroTarjeta: t.numero, titular: "LAURA PETRO", vencimiento: "12/29", cvv: "123" })}>
              <span className="mono">{t.numero}</span>
              <span>{t.texto}</span>
            </button>
          ))}
        </div>
      </div>
      <label className="campo">
        <span>Número de tarjeta</span>
        <input className="entrada mono" inputMode="numeric" autoComplete="cc-number" placeholder="0000 0000 0000 0000"
          value={tarjeta.numeroTarjeta} onChange={(e) => cambiar("numeroTarjeta", espaciar(e.target.value))} required />
      </label>
      <label className="campo">
        <span>Titular</span>
        <input className="entrada" autoComplete="cc-name" value={tarjeta.titular}
          onChange={(e) => cambiar("titular", e.target.value.toUpperCase())} required />
      </label>
      <div className="dos-columnas">
        <label className="campo">
          <span>Vencimiento</span>
          <input className="entrada mono" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA"
            value={tarjeta.vencimiento} onChange={(e) => cambiar("vencimiento", vencimiento(e.target.value))} required />
        </label>
        <label className="campo">
          <span>CVV</span>
          <input className="entrada mono" inputMode="numeric" autoComplete="cc-csc" placeholder="123" type="password"
            value={tarjeta.cvv} onChange={(e) => cambiar("cvv", e.target.value.replace(/\D/g, "").slice(0, 4))} required />
        </label>
      </div>
      <p className="secundario nota-segura"><Icono nombre="check" tamano={16} /> Solo se guardan la marca y los últimos 4 dígitos.</p>
      <button className="boton boton-primario boton-ancho" disabled={!completo || enviando}>
        {enviando ? "Procesando pago…" : textoBoton}
      </button>
    </form>
  );
}
