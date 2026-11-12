import { Link, Outlet } from "react-router-dom";
import { api } from "../../api/cliente.js";
import { CabeceraZona, CajaError, Cargando, Sello } from "../../componentes/comunes.jsx";
import { useCarga } from "./utiles.jsx";
import Solicitud from "./Solicitud.jsx";
import "../../estilos/vendedor.css";

const ESTADOS_PUESTO = {
  APROBADO: ["exito", "Puesto abierto"],
  PENDIENTE: ["aviso", "En revisión"],
  SUSPENDIDO: ["error", "Suspendido"],
  RECHAZADO: ["error", "Solicitud rechazada"],
};

const PESTANAS = [
  { a: "/mi-puesto", texto: "Resumen", icono: "puesto", exacto: true },
  { a: "/mi-puesto/productos", texto: "Productos", icono: "caja" },
  { a: "/mi-puesto/inventario", texto: "Inventario", icono: "servidor" },
  { a: "/mi-puesto/pedidos", texto: "Pedidos", icono: "camion" },
];

export default function ZonaVendedor() {
  const { datos: vendedor, cargando, error, recargar } = useCarga(
    () => api("/vendedores/yo").catch((e) => { if (e.status === 404) return false; throw e; }),
    [],
  );

  if (cargando) return <div className="contenedor pagina"><Cargando alto={180} filas={2} /></div>;
  if (error) return <div className="contenedor pagina"><CajaError error={error} alReintentar={recargar} /></div>;

  const aprobado = vendedor?.estado === "APROBADO";
  const [tono, textoEstado] = ESTADOS_PUESTO[vendedor?.estado] || ["neutro", "Sin puesto"];

  return (
    <div className="vend-zona">
      <div className="toldo vend-toldo" style={{ "--color-toldo": vendedor?.color || "#E4572E" }} aria-hidden="true" />
      {aprobado ? (
        <>
          <CabeceraZona
            titulo={vendedor.nombreTienda}
            subtitulo={<span className="fila" style={{ gap: 10 }}>{vendedor.ciudad} <Sello tono={tono}>{textoEstado}</Sello></span>}
            pestanas={PESTANAS}
            extra={<Link to={`/puestos/${vendedor.id}`} className="boton boton-sm">Ver mi puesto en la plaza</Link>}
          />
          <div className="contenedor pagina">
            <Outlet context={{ vendedor, recargarVendedor: recargar }} />
          </div>
        </>
      ) : (
        <div className="contenedor pagina">
          <Solicitud vendedor={vendedor || null} alEnviar={recargar} />
        </div>
      )}
    </div>
  );
}
