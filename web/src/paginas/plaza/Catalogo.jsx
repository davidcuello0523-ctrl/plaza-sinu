import { useSearchParams } from "react-router-dom";
import { pesos } from "../../api/formato.js";
import { CajaError, Cargando, Vacio } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import TarjetaProducto from "./TarjetaProducto.jsx";
import { useDatos } from "./comun.js";
import "../../estilos/plaza.css";

const FILTROS = ["q", "categoria", "vendedor", "precioMin", "precioMax", "soloDisponibles", "estadoStock", "orden", "pagina"];
const PRECIOS = [
  { texto: `Hasta ${pesos(100000)}`, max: 100000 },
  { texto: `${pesos(100000)} a ${pesos(500000)}`, min: 100000, max: 500000 },
  { texto: `${pesos(500000)} a ${pesos(1500000)}`, min: 500000, max: 1500000 },
  { texto: `Más de ${pesos(1500000)}`, min: 1500000 },
];

function Chip({ activo, onClick, children }) {
  return <button type="button" className="chip" aria-pressed={activo} onClick={onClick}>{children}</button>;
}

export default function Catalogo() {
  const [params, setParams] = useSearchParams();
  const categorias = useDatos("/categorias");
  const vendedores = useDatos("/vendedores");

  const consulta = new URLSearchParams();
  for (const k of FILTROS) if (params.get(k)) consulta.set(k, params.get(k));
  consulta.set("porPagina", "12");
  const productos = useDatos(`/productos?${consulta}`);

  const cambiar = (cambios) => {
    const nuevo = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) (v === undefined || v === null || v === "" ? nuevo.delete(k) : nuevo.set(k, v));
    if (!("pagina" in cambios)) nuevo.delete("pagina");
    setParams(nuevo);
  };
  const alternar = (k, v) => cambiar({ [k]: params.get(k) === v ? undefined : v });

  const q = params.get("q");
  const pagina = Number(params.get("pagina") || 1);
  const r = productos.datos;
  const hayFiltros = FILTROS.some((k) => k !== "orden" && k !== "pagina" && params.get(k));

  return (
    <div className="contenedor pagina catalogo">
      <div className="catalogo-cabeza">
        <h1>{q ? `Resultados para “${q}”` : "Todo lo que hay en la plaza"}</h1>
        <p className="secundario" aria-live="polite">
          {r ? (r.total === 1 ? "1 producto" : `${r.total} productos`) : "Buscando productos…"}
        </p>
      </div>

      <div className="filtros" role="group" aria-label="Filtros del catálogo">
        <div className="filtro-grupo">
          <span className="filtro-titulo">Categoría</span>
          <div className="chips">
            {(categorias.datos?.datos || []).map((c) => (
              <Chip key={c.slug} activo={params.get("categoria") === c.slug} onClick={() => alternar("categoria", c.slug)}>{c.nombre}</Chip>
            ))}
          </div>
        </div>
        <div className="filtro-grupo">
          <span className="filtro-titulo">Puesto</span>
          <div className="chips">
            {(vendedores.datos?.datos || []).map((v) => (
              <Chip key={v.id} activo={params.get("vendedor") === v.id} onClick={() => alternar("vendedor", v.id)}>
                <span className="punto" style={{ background: v.color }} aria-hidden="true" />{v.nombreTienda}
              </Chip>
            ))}
          </div>
        </div>
        <div className="filtro-grupo">
          <span className="filtro-titulo">Precio</span>
          <div className="chips">
            {PRECIOS.map((pr) => {
              const activo = params.get("precioMin") === (pr.min ? String(pr.min) : null) && params.get("precioMax") === (pr.max ? String(pr.max) : null);
              return (
                <Chip key={pr.texto} activo={activo}
                  onClick={() => cambiar(activo ? { precioMin: undefined, precioMax: undefined } : { precioMin: pr.min, precioMax: pr.max })}>
                  {pr.texto}
                </Chip>
              );
            })}
            <Chip activo={params.get("soloDisponibles") === "true"} onClick={() => alternar("soloDisponibles", "true")}>
              <Icono nombre="check" tamano={16} /> Solo disponibles
            </Chip>
          </div>
        </div>
        <div className="fila entre filtro-pie">
          <label className="fila orden">
            <span>Ordenar por</span>
            <select className="selector" value={params.get("orden") || "recientes"} onChange={(e) => cambiar({ orden: e.target.value })}>
              <option value="recientes">Más recientes</option>
              <option value="precio_asc">Menor precio</option>
              <option value="precio_desc">Mayor precio</option>
              <option value="nombre">Nombre</option>
            </select>
          </label>
          {hayFiltros && <button className="boton boton-plano boton-sm" onClick={() => setParams({})}><Icono nombre="x" tamano={16} /> Quitar filtros</button>}
        </div>
      </div>

      <CajaError error={productos.error} alReintentar={productos.recargar} />
      {productos.cargando && !r ? <Cargando alto={320} filas={1} /> : r?.datos?.length === 0 ? (
        <Vacio icono="buscar" titulo="Ningún puesto tiene eso por ahora"
          accion={<button className="boton" onClick={() => setParams({})}>Ver todo el catálogo</button>}>
          Prueba con otra palabra o quita algunos filtros.
        </Vacio>
      ) : r && (
        <>
          <div className={`rejilla-productos ${productos.cargando ? "atenuada" : ""}`}>
            {r.datos.map((p) => <TarjetaProducto key={p.id} producto={p} />)}
          </div>
          {r.totalPaginas > 1 && (
            <nav className="paginacion" aria-label="Páginas del catálogo">
              <button className="boton boton-sm" disabled={pagina <= 1} onClick={() => cambiar({ pagina: pagina - 1 })}>
                <Icono nombre="atras" tamano={16} /> Anterior
              </button>
              <span>Página {pagina} de {r.totalPaginas}</span>
              <button className="boton boton-sm" disabled={pagina >= r.totalPaginas} onClick={() => cambiar({ pagina: pagina + 1 })}>
                Siguiente <Icono nombre="adelante" tamano={16} />
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
