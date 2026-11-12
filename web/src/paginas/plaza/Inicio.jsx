// Inicio de La Plaza: los puestos abiertos hoy y rieles por categoría.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/cliente.js";
import { usePlaza } from "../../estado/plaza.jsx";
import { CajaError, Cargando, Vacio } from "../../componentes/comunes.jsx";
import TarjetaPuesto from "./TarjetaPuesto.jsx";
import TarjetaProducto from "./TarjetaProducto.jsx";
import Riel from "./Riel.jsx";
import { useDatos } from "./comun.js";
import "../../estilos/plaza.css";

export default function Inicio() {
  const { ciudad } = usePlaza();
  const enCiudad = (x) => ciudad === "Todas" || x.ciudad === ciudad;
  const vendedores = useDatos("/vendedores");
  const recientes = useDatos("/productos?orden=recientes&porPagina=10");
  const ultimas = useDatos("/productos?estadoStock=ultimas_unidades&porPagina=12");
  const [rieles, setRieles] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { datos: categorias } = await api("/categorias");
        const listas = await Promise.all(categorias.map((c) => api(`/productos?categoria=${c.slug}&porPagina=8`)));
        if (vivo) setRieles(categorias.map((c, i) => ({ ...c, productos: listas[i].datos })));
      } catch {
        if (vivo) setRieles([]);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const puestos = (vendedores.datos?.datos || []).filter(enCiudad);
  const lugar = ciudad === "Todas" ? "Córdoba" : ciudad;
  const ultimasCiudad = (ultimas.datos?.datos || []).filter(enCiudad);
  const recientesCiudad = (recientes.datos?.datos || []).filter(enCiudad);

  return (
    <div className="inicio">
      <section className="portada">
        <div className="contenedor">
          <div className="portada-texto">
            <h1>El mercado de {lugar}, abierto todo el día</h1>
            <p>Compra a varias tiendas locales en un solo carrito. Cada puesto despacha lo suyo y tú sigues tu pedido paso a paso.</p>
            <div className="fila">
              <Link to="/catalogo" className="boton boton-primario">Recorrer la plaza</Link>
              <Link to="/registro" className="boton">Abrir mi puesto</Link>
            </div>
          </div>
        </div>
        <div className="contenedor">
          {vendedores.error && <CajaError error={vendedores.error} alReintentar={vendedores.recargar} />}
          {vendedores.cargando ? <Cargando alto={190} /> : puestos.length === 0 && !vendedores.error ? (
            <Vacio icono="puesto" titulo={`Aún no hay puestos abiertos en ${ciudad}`}>Prueba con otra ciudad en la barra de arriba.</Vacio>
          ) : (
            <ul className="hilera-puestos" aria-label="Puestos de la plaza">
              {puestos.map((v, i) => (
                <li key={v.id} style={{ "--orden": i }}><TarjetaPuesto vendedor={v} /></li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="contenedor pila rieles" style={{ "--pila": "56px" }}>
        {ultimasCiudad.length > 0 && (
          <Riel id="riel-ultimas" titulo="Últimas unidades" descripcion="Se están acabando en el inventario de sus puestos." verTodo="/catalogo?estadoStock=ultimas_unidades">
            {ultimasCiudad.map((p) => <TarjetaProducto key={p.id} producto={p} />)}
          </Riel>
        )}
        {recientesCiudad.length > 0 && (
          <Riel id="riel-recientes" titulo="Recién llegados" descripcion="Lo último que publicaron los vendedores." verTodo="/catalogo?orden=recientes">
            {recientesCiudad.map((p) => <TarjetaProducto key={p.id} producto={p} />)}
          </Riel>
        )}
        {!rieles ? <Cargando alto={260} filas={2} /> : rieles.filter((c) => c.productos.some(enCiudad)).map((c) => (
          <Riel key={c.slug} id={`riel-${c.slug}`} titulo={c.nombre} verTodo={`/catalogo?categoria=${c.slug}`}>
            {c.productos.filter(enCiudad).map((p) => <TarjetaProducto key={p.id} producto={p} />)}
          </Riel>
        ))}
      </div>
    </div>
  );
}
