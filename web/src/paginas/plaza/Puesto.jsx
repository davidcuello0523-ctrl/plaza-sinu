import { Link, useParams } from "react-router-dom";
import { CajaError, Cargando, Vacio } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import TarjetaProducto from "./TarjetaProducto.jsx";
import { NOMBRES_CATEGORIA, iniciales, useDatos } from "./comun.js";
import "../../estilos/plaza.css";

function Estrellas({ valor }) {
  return (
    <span className="estrellas" aria-label={`${valor.toFixed(1)} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < Math.round(valor) ? "llena" : ""} aria-hidden="true"><Icono nombre="estrella" tamano={18} /></span>
      ))}
    </span>
  );
}

export default function Puesto() {
  const { id } = useParams();
  const vendedor = useDatos(`/vendedores/${id}`);
  const productos = useDatos(`/productos?vendedor=${id}&porPagina=60`);
  const v = vendedor.datos;

  if (vendedor.cargando) return <div className="contenedor pagina"><Cargando alto={300} /></div>;
  if (vendedor.error?.status === 404) {
    return (
      <div className="contenedor pagina">
        <Vacio icono="puesto" titulo="Este puesto no está abierto" accion={<Link className="boton" to="/">Volver a la plaza</Link>}>
          Puede que aún esté esperando aprobación o que haya cerrado.
        </Vacio>
      </div>
    );
  }
  if (vendedor.error) return <div className="contenedor pagina"><CajaError error={vendedor.error} alReintentar={vendedor.recargar} /></div>;

  const lista = productos.datos?.datos || [];
  return (
    <div className="puesto">
      <header className="puesto-portada" style={{ "--color-toldo": v.color }}>
        <div className="toldo toldo-grande" aria-hidden="true" />
        <div className="contenedor puesto-portada-cuerpo">
          <span className="logo-puesto logo-grande" aria-hidden="true">{iniciales(v.nombreTienda)}</span>
          <div className="pila" style={{ "--pila": "10px" }}>
            <h1>{v.nombreTienda}</h1>
            <p className="puesto-descripcion">{v.descripcion}</p>
            <div className="fila puesto-datos">
              <span><Icono nombre="ubicacion" tamano={18} /> {v.ciudad}</span>
              <span><Icono nombre="puesto" tamano={18} /> {NOMBRES_CATEGORIA[v.categoriaPrincipal] || v.categoriaPrincipal}</span>
              <span className="fila" style={{ gap: 6 }}>
                <Estrellas valor={Number(v.reputacion)} /> <span className="cifra">{Number(v.reputacion).toFixed(1)}</span>
                <span className="secundario">({v.totalResenas} reseñas)</span>
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="contenedor pagina">
        <div className="fila entre" style={{ marginBottom: 20 }}>
          <h2>En este puesto</h2>
          <span className="secundario">{lista.length === 1 ? "1 producto" : `${lista.length} productos`}</span>
        </div>
        <CajaError error={productos.error} alReintentar={productos.recargar} />
        {productos.cargando ? <Cargando alto={300} /> : lista.length === 0 ? (
          <Vacio icono="caja" titulo="Este puesto todavía no ha publicado productos" />
        ) : (
          <div className="rejilla-productos">
            {lista.map((p) => <TarjetaProducto key={p.id} producto={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
