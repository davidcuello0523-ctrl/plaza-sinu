import { useRef } from "react";
import { Link } from "react-router-dom";
import Icono from "../../componentes/Icono.jsx";

export default function Riel({ titulo, descripcion, verTodo, children, id }) {
  const pista = useRef(null);
  const mover = (dir) => pista.current?.scrollBy({ left: dir * pista.current.clientWidth * 0.8, behavior: "smooth" });
  return (
    <section className="riel" aria-labelledby={id}>
      <div className="riel-cabeza">
        <div>
          <h2 id={id}>{titulo}</h2>
          {descripcion && <p className="secundario">{descripcion}</p>}
        </div>
        <div className="fila">
          {verTodo && <Link to={verTodo} className="enlace-ver">Ver todo</Link>}
          <button className="boton boton-icono boton-sm" onClick={() => mover(-1)} aria-label={`Anteriores en ${titulo}`}><Icono nombre="atras" /></button>
          <button className="boton boton-icono boton-sm" onClick={() => mover(1)} aria-label={`Siguientes en ${titulo}`}><Icono nombre="adelante" /></button>
        </div>
      </div>
      <div className="riel-pista" ref={pista} tabIndex={0} role="region" aria-label={titulo}>
        {children}
      </div>
    </section>
  );
}
