// Zona del administrador: la "sala de máquinas" donde se ven los servicios y los eventos pasar.
import { Outlet } from "react-router-dom";
import { CabeceraZona } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import { URL_RABBIT, URL_SWAGGER } from "./monitor.js";
import "../../estilos/admin.css";

const PESTANAS = [
  { a: "/sala", texto: "Mapa de servicios", icono: "mapa", exacto: true },
  { a: "/sala/eventos", texto: "Radar de eventos", icono: "radar" },
  { a: "/sala/vendedores", texto: "Vendedores", icono: "puesto" },
  { a: "/sala/usuarios", texto: "Usuarios", icono: "usuario" },
  { a: "/sala/pedidos", texto: "Pedidos", icono: "caja" },
  { a: "/sala/metricas", texto: "Métricas", icono: "grafica" },
];

export default function ZonaAdmin() {
  return (
    <>
      <CabeceraZona
        oscura
        titulo="Sala de máquinas"
        subtitulo="Los 7 microservicios de Plaza Sinú, sus bases de datos y los eventos que se pasan entre ellos."
        pestanas={PESTANAS}
        extra={
          <div className="fila">
            <a className="boton boton-sm" href={URL_SWAGGER} target="_blank" rel="noreferrer"><Icono nombre="documento" tamano={18} /> Swagger</a>
            <a className="boton boton-sm" href={URL_RABBIT} target="_blank" rel="noreferrer"><Icono nombre="rayo" tamano={18} /> RabbitMQ</a>
          </div>
        }
      />
      <div className="contenedor pagina sala">
        <Outlet />
      </div>
    </>
  );
}
