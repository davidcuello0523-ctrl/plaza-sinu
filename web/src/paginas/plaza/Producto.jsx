// Detalle de producto: galería, atributos por categoría, stock en vivo y ficha del puesto.
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, urlRecurso } from "../../api/cliente.js";
import { pesos } from "../../api/formato.js";
import { CajaError, Cargando, Vacio } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import { BarraStock, useAgregar } from "./TarjetaProducto.jsx";
import { NOMBRES_CATEGORIA, atributoLegible, iniciales, useDatos } from "./comun.js";
import "../../estilos/plaza.css";

// Stock en vivo: lo da inventario (la fuente de verdad), no la copia del catálogo.
function useStock(id) {
  const [stock, setStock] = useState(null);
  useEffect(() => {
    let vivo = true;
    const leer = () => api(`/inventario/${id}`).then((s) => vivo && setStock(s)).catch(() => vivo && setStock(null));
    leer();
    const t = setInterval(leer, 10000);
    return () => { vivo = false; clearInterval(t); };
  }, [id]);
  return stock;
}

export default function Producto() {
  const { id } = useParams();
  const producto = useDatos(`/productos/${id}`);
  const p = producto.datos;
  const vendedor = useDatos(p ? `/vendedores/${p.vendedorId}` : null);
  const stock = useStock(id);
  const [imagen, setImagen] = useState(0);
  const [cantidad, setCantidad] = useState(1);
  const { agregar, ocupado, puedeComprar } = useAgregar();

  if (producto.cargando) return <div className="contenedor pagina"><Cargando alto={420} /></div>;
  if (producto.error?.status === 404) {
    return (
      <div className="contenedor pagina">
        <Vacio icono="buscar" titulo="Este producto ya no está en la plaza" accion={<Link className="boton" to="/catalogo">Ver el catálogo</Link>}>
          Puede que el vendedor lo haya retirado.
        </Vacio>
      </div>
    );
  }
  if (producto.error) return <div className="contenedor pagina"><CajaError error={producto.error} alReintentar={producto.recargar} /></div>;

  const disponible = stock?.disponible ?? p.stockDisponible ?? 0;
  const estado = stock?.estado ?? p.estadoStock;
  const max = Math.max(1, Math.min(disponible, 20));
  const v = vendedor.datos;
  const imagenes = p.imagenes?.length ? p.imagenes : [""];

  return (
    <div className="contenedor pagina producto">
      <nav className="migas" aria-label="Ruta">
        <Link to="/catalogo">Catálogo</Link> / <Link to={`/catalogo?categoria=${p.categoria}`}>{NOMBRES_CATEGORIA[p.categoria]}</Link>
      </nav>
      <div className="producto-rejilla">
        <div className="galeria">
          <div className="galeria-principal" style={{ "--color-puesto": p.colorTienda }}>
            <img src={urlRecurso(imagenes[imagen])} alt={p.nombre} />
          </div>
          {imagenes.length > 1 && (
            <div className="miniaturas">
              {imagenes.map((src, i) => (
                <button key={src + i} aria-pressed={i === imagen} aria-label={`Ver imagen ${i + 1}`} onClick={() => setImagen(i)}>
                  <img src={urlRecurso(src)} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="producto-info pila" style={{ "--pila": "20px" }}>
          <div>
            <h1 className="producto-nombre">{p.nombre}</h1>
            <p className="cifra producto-precio">{pesos(p.precio)}</p>
          </div>
          {p.descripcion && <p>{p.descripcion}</p>}

          <div className="caja-compra">
            <div className="fila entre">
              <BarraStock estado={estado} disponible={disponible} />
              <span className="secundario" aria-live="polite">
                {stock ? `${disponible} disponibles ahora` : "Consultando inventario…"}
              </span>
            </div>
            {puedeComprar && estado !== "agotado" && (
              <div className="fila">
                <div className="paso-cantidad" role="group" aria-label="Cantidad">
                  <button className="boton boton-icono boton-sm" disabled={cantidad <= 1} onClick={() => setCantidad((c) => c - 1)} aria-label="Quitar una unidad"><Icono nombre="menos" /></button>
                  <output className="cifra" aria-live="polite">{Math.min(cantidad, max)}</output>
                  <button className="boton boton-icono boton-sm" disabled={cantidad >= max} onClick={() => setCantidad((c) => c + 1)} aria-label="Sumar una unidad"><Icono nombre="mas" /></button>
                </div>
                <button className="boton boton-primario" disabled={ocupado} onClick={() => agregar(p.id, Math.min(cantidad, max))}>
                  <Icono nombre="carrito" /> Agregar al carrito
                </button>
              </div>
            )}
            {estado === "agotado" && <p className="secundario">Este puesto se quedó sin unidades. Vuelve pronto o mira otros puestos.</p>}
          </div>

          {Object.keys(p.atributos || {}).length > 0 && (
            <section>
              <h2 className="subtitulo">Características</h2>
              <dl className="atributos">
                {Object.entries(p.atributos).map(([k, val]) => {
                  const [etiqueta, texto] = atributoLegible(k, val);
                  return <div key={k}><dt>{etiqueta}</dt><dd>{texto}</dd></div>;
                })}
              </dl>
            </section>
          )}

          <Link to={`/puestos/${p.vendedorId}`} className="ficha-puesto" style={{ "--color-toldo": p.colorTienda }}>
            <div className="toldo toldo-mini" aria-hidden="true" />
            <div className="fila ficha-cuerpo">
              <span className="logo-puesto" aria-hidden="true">{iniciales(p.nombreTienda)}</span>
              <div>
                <strong>{p.nombreTienda}</strong>
                <p className="secundario">
                  {v ? `${v.ciudad}, ${Number(v.reputacion).toFixed(1)} de 5 en ${v.totalResenas} reseñas` : p.ciudad}
                </p>
              </div>
              <span className="ficha-ir">Ver puesto</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
