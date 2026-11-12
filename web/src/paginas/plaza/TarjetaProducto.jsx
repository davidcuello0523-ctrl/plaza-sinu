// Tarjeta de producto: imagen a sangre con el sello del puesto, precio y stock.
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { api, urlRecurso } from "../../api/cliente.js";
import { pesos } from "../../api/formato.js";
import { useSesion } from "../../estado/sesion.jsx";
import { usePlaza } from "../../estado/plaza.jsx";
import Icono from "../../componentes/Icono.jsx";
import { iniciales } from "./comun.js";
import "../../estilos/plaza.css";

// Barra de 5 segmentos: cuánto queda del producto, sin dar la cifra exacta.
export function BarraStock({ estado, disponible }) {
  const llenos = estado === "agotado" ? 0 : estado === "ultimas_unidades" ? 1 : Math.min(5, Math.max(2, Math.ceil((disponible ?? 10) / 6)));
  const ultimas = disponible === 1 ? "Queda 1 unidad" : disponible ? `Quedan ${disponible} unidades` : "Últimas unidades";
  const texto = estado === "agotado" ? "Agotado" : estado === "ultimas_unidades" ? ultimas : "Disponible";
  return (
    <span className={`barra-stock stock-${estado || "disponible"}`}>
      <span className="segmentos" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => <i key={i} className={i < llenos ? "lleno" : ""} />)}
      </span>
      {texto}
    </span>
  );
}

// Botón "Agregar" reutilizable (tarjeta y detalle).
export function useAgregar() {
  const { usuario } = useSesion();
  const { setCarrito, avisar } = usePlaza();
  const navegar = useNavigate();
  const { pathname } = useLocation();
  const [ocupado, setOcupado] = useState(false);
  const puedeComprar = !usuario || usuario.rol === "cliente";
  async function agregar(productoId, cantidad = 1) {
    if (!usuario) return navegar("/entrar", { state: { desde: pathname } });
    setOcupado(true);
    try {
      setCarrito(await api("/carrito/items", { metodo: "POST", cuerpo: { productoId, cantidad } }));
      avisar("Agregado al carrito", "exito");
    } catch (e) {
      avisar(e.message, "error");
    } finally {
      setOcupado(false);
    }
  }
  return { agregar, ocupado, puedeComprar };
}

export default function TarjetaProducto({ producto: p }) {
  const { agregar, ocupado, puedeComprar } = useAgregar();
  const agotado = p.estadoStock === "agotado";
  return (
    <article className="tarjeta-producto">
      <Link to={`/productos/${p.id}`} className="tp-enlace">
        <div className="tp-imagen" style={{ "--color-puesto": p.colorTienda }}>
          <img src={urlRecurso(p.imagenes?.[0])} alt="" loading="lazy" />
          <span className="sello-puesto" title={p.nombreTienda} aria-hidden="true">{iniciales(p.nombreTienda)}</span>
        </div>
        <div className="tp-cuerpo">
          <span className="tp-tienda">{p.nombreTienda}</span>
          <h3 className="tp-nombre">{p.nombre}</h3>
        </div>
      </Link>
      <div className="tp-pie">
        <div>
          <p className="cifra tp-precio">{pesos(p.precio)}</p>
          <BarraStock estado={p.estadoStock} disponible={p.stockDisponible} />
        </div>
        {puedeComprar && (
          <button className="boton boton-primario boton-sm" disabled={agotado || ocupado}
            onClick={() => agregar(p.id)} aria-label={`Agregar ${p.nombre} al carrito`}>
            <Icono nombre="mas" tamano={16} /> {agotado ? "Agotado" : "Agregar"}
          </button>
        )}
      </div>
    </article>
  );
}
