// Rutas reales (React Router, sin hash). Tres zonas: La Plaza (cliente),
// Mi Puesto (vendedor) y Sala de Máquinas (admin).
import { lazy, Suspense } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import BarraSuperior from "./componentes/BarraSuperior.jsx";
import { Avisos, Cargando, RutaProtegida, Vacio } from "./componentes/comunes.jsx";
import ModoSustentacion from "./componentes/ModoSustentacion.jsx";
import PanelCliente from "./componentes/PanelCliente.jsx";
import { useSesion } from "./estado/sesion.jsx";

const p = (cargar) => lazy(cargar);
// La Plaza
const Inicio = p(() => import("./paginas/plaza/Inicio.jsx"));
const Catalogo = p(() => import("./paginas/plaza/Catalogo.jsx"));
const Producto = p(() => import("./paginas/plaza/Producto.jsx"));
const Puesto = p(() => import("./paginas/plaza/Puesto.jsx"));
// Compra
const Entrar = p(() => import("./paginas/compra/Entrar.jsx"));
const Carrito = p(() => import("./paginas/compra/Carrito.jsx"));
const Checkout = p(() => import("./paginas/compra/Checkout.jsx"));
const MisPedidos = p(() => import("./paginas/compra/MisPedidos.jsx"));
const Pedido = p(() => import("./paginas/compra/Pedido.jsx"));
// Mi Puesto (vendedor)
const ZonaVendedor = p(() => import("./paginas/vendedor/ZonaVendedor.jsx"));
const ResumenPuesto = p(() => import("./paginas/vendedor/Resumen.jsx"));
const ProductosPuesto = p(() => import("./paginas/vendedor/Productos.jsx"));
const InventarioPuesto = p(() => import("./paginas/vendedor/Inventario.jsx"));
const PedidosPuesto = p(() => import("./paginas/vendedor/Pedidos.jsx"));
const SolicitudPuesto = p(() => import("./paginas/vendedor/Solicitud.jsx"));
// Sala de Máquinas (admin)
const ZonaAdmin = p(() => import("./paginas/admin/ZonaAdmin.jsx"));
const MapaServicios = p(() => import("./paginas/admin/Mapa.jsx"));
const RadarEventos = p(() => import("./paginas/admin/Eventos.jsx"));
const VendedoresAdmin = p(() => import("./paginas/admin/Vendedores.jsx"));
const UsuariosAdmin = p(() => import("./paginas/admin/Usuarios.jsx"));
const PedidosAdmin = p(() => import("./paginas/admin/Pedidos.jsx"));
const MetricasAdmin = p(() => import("./paginas/admin/Metricas.jsx"));

const cliente = (el) => <RutaProtegida roles={["cliente"]}>{el}</RutaProtegida>;

export default function App() {
  const { pathname } = useLocation();
  const { rol } = useSesion();
  const sinBarra = pathname === "/entrar" || pathname === "/registro";
  const conPanel = rol === "cliente" && !sinBarra;
  return (
    <>
      <a href="#contenido" className="solo-lectores">Saltar al contenido</a>
      {!sinBarra && <BarraSuperior />}
      <div className={conPanel ? "con-panel" : undefined}>
      {conPanel && <PanelCliente />}
      <main id="contenido">
        <Suspense fallback={<div className="contenedor pagina"><Cargando alto={220} /></div>}>
          <Routes>
            <Route path="/" element={<Inicio />} />
            <Route path="/catalogo" element={<Catalogo />} />
            <Route path="/productos/:id" element={<Producto />} />
            <Route path="/puestos/:id" element={<Puesto />} />
            <Route path="/entrar" element={<Entrar modo="entrar" />} />
            <Route path="/registro" element={<Entrar modo="registro" />} />
            <Route path="/carrito" element={cliente(<Carrito />)} />
            <Route path="/checkout" element={cliente(<Checkout />)} />
            <Route path="/pedidos" element={<RutaProtegida><MisPedidos /></RutaProtegida>} />
            <Route path="/pedidos/:id" element={<RutaProtegida><Pedido /></RutaProtegida>} />

            <Route path="/mi-puesto" element={<RutaProtegida roles={["vendedor"]}><ZonaVendedor /></RutaProtegida>}>
              <Route index element={<ResumenPuesto />} />
              <Route path="productos" element={<ProductosPuesto />} />
              <Route path="inventario" element={<InventarioPuesto />} />
              <Route path="pedidos" element={<PedidosPuesto />} />
              <Route path="solicitud" element={<SolicitudPuesto />} />
            </Route>

            <Route path="/sala" element={<RutaProtegida roles={["admin"]}><ZonaAdmin /></RutaProtegida>}>
              <Route index element={<MapaServicios />} />
              <Route path="eventos" element={<RadarEventos />} />
              <Route path="vendedores" element={<VendedoresAdmin />} />
              <Route path="usuarios" element={<UsuariosAdmin />} />
              <Route path="pedidos" element={<PedidosAdmin />} />
              <Route path="metricas" element={<MetricasAdmin />} />
            </Route>

            <Route path="*" element={<div className="contenedor pagina"><Vacio icono="alerta" titulo="Esta página no existe">Revisa la dirección o vuelve a la plaza.</Vacio></div>} />
          </Routes>
        </Suspense>
      </main>
      </div>
      <Avisos />
      <ModoSustentacion />
    </>
  );
}
