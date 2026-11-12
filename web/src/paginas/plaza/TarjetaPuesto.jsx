// Tarjeta de puesto: el toldo a rayas con el color de la tienda.
import { Link } from "react-router-dom";
import Icono from "../../componentes/Icono.jsx";
import { NOMBRES_CATEGORIA, iniciales } from "./comun.js";
import "../../estilos/plaza.css";

export default function TarjetaPuesto({ vendedor: v }) {
  return (
    <Link to={`/puestos/${v.id}`} className="tarjeta-puesto" style={{ "--color-toldo": v.color }}>
      <div className="toldo" aria-hidden="true" />
      <div className="puesto-cuerpo">
        <span className="logo-puesto" aria-hidden="true">{iniciales(v.nombreTienda)}</span>
        <h3>{v.nombreTienda}</h3>
        <p className="secundario">{NOMBRES_CATEGORIA[v.categoriaPrincipal] || v.categoriaPrincipal}</p>
        <div className="fila puesto-datos">
          <span><Icono nombre="ubicacion" tamano={16} /> {v.ciudad}</span>
          <span><Icono nombre="estrella" tamano={16} /> {Number(v.reputacion).toFixed(1)}</span>
        </div>
      </div>
    </Link>
  );
}
