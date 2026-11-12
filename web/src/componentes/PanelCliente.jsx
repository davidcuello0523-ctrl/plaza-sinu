import { Link, useLocation, useNavigate } from "react-router-dom";
import { useSesion } from "../estado/sesion.jsx";
import { usePlaza } from "../estado/plaza.jsx";
import { useDatos } from "../paginas/plaza/comun.js";
import Icono from "./Icono.jsx";
import "../estilos/panel-cliente.css";

export default function PanelCliente() {
  const { usuario, salir } = useSesion();
  const { carrito, noLeidas } = usePlaza();
  const categorias = useDatos("/categorias");
  const { pathname, search } = useLocation();
  const navegar = useNavigate();
  const categoriaActual = pathname === "/catalogo" ? new URLSearchParams(search).get("categoria") : null;

  const secciones = [
    { a: "/", texto: "Inicio", icono: "puesto", activo: pathname === "/" },
    { a: "/catalogo", texto: "Catálogo", icono: "buscar", activo: pathname === "/catalogo" && !categoriaActual },
    { a: "/carrito", texto: "Mi carrito", icono: "carrito", activo: pathname === "/carrito" || pathname === "/checkout", cifra: carrito?.unidades },
    { a: "/pedidos", texto: "Mis pedidos", icono: "caja", activo: pathname.startsWith("/pedidos"), cifra: noLeidas, etiqueta: "avisos sin leer" },
  ];

  return (
    <aside className="panel-cliente" aria-label="Panel del cliente">
      <div className="pc-saludo">
        <span className="secundario">Hola,</span>
        <strong>{usuario.nombre.split(" ")[0]}</strong>
      </div>

      <nav className="pc-nav" aria-label="Secciones">
        {secciones.map((s) => (
          <Link key={s.a} to={s.a} className={`pc-enlace${s.activo ? " activo" : ""}`} aria-current={s.activo ? "page" : undefined}>
            <Icono nombre={s.icono} tamano={20} />
            <span>{s.texto}</span>
            {s.cifra > 0 && <span className="pc-cifra" aria-label={`${s.cifra} ${s.etiqueta || "unidades"}`}>{s.cifra > 99 ? "99+" : s.cifra}</span>}
          </Link>
        ))}
      </nav>

      {categorias.datos?.datos?.length > 0 && (
        <div className="pc-categorias">
          <h2 className="pc-titulo">Categorías</h2>
          <nav aria-label="Categorías">
            {categorias.datos.datos.map((c) => (
              <Link key={c.slug} to={`/catalogo?categoria=${c.slug}`}
                className={`pc-enlace pc-sub${categoriaActual === c.slug ? " activo" : ""}`}
                aria-current={categoriaActual === c.slug ? "page" : undefined}>
                {c.nombre}
              </Link>
            ))}
          </nav>
        </div>
      )}

      <button type="button" className="pc-enlace pc-salir" onClick={async () => { await salir(); navegar("/"); }}>
        <Icono nombre="salir" tamano={20} /> <span>Cerrar sesión</span>
      </button>
    </aside>
  );
}
