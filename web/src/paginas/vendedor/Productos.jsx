import { useState } from "react";
import { Link } from "react-router-dom";
import { api, urlRecurso } from "../../api/cliente.js";
import { pesos } from "../../api/formato.js";
import { CajaError, Cargando, Sello, Vacio } from "../../componentes/comunes.jsx";
import Icono from "../../componentes/Icono.jsx";
import { usePlaza } from "../../estado/plaza.jsx";
import { Campo } from "./Solicitud.jsx";
import { Dialogo, erroresPorCampo, useCarga } from "./utiles.jsx";

const ATRIBUTOS = {
  tecnologia: [["marca", "Marca"], ["memoria", "Memoria"], ["voltaje", "Voltaje"], ["garantiaMeses", "Garantía (meses)"]],
  bicicletas: [["rin", "Rin"], ["talla", "Talla"], ["material", "Material"], ["cambios", "Cambios"]],
  ropa: [["talla", "Talla"], ["color", "Color"], ["material", "Material"]],
  hogar: [["material", "Material"], ["medidas", "Medidas"]],
  artesanias: [["tecnica", "Técnica"], ["origen", "Origen"], ["vueltas", "Vueltas"]],
  papeleria: [["presentacion", "Presentación"], ["unidades", "Unidades"]],
  deportes: [["talla", "Talla"], ["deporte", "Deporte"]],
};

const VACIO = { nombre: "", descripcion: "", precio: "", categoria: "", atributos: {}, publicado: true };

function FormularioProducto({ producto, categorias, alGuardar, alCerrar }) {
  const { avisar } = usePlaza();
  const [form, setForm] = useState(() => (producto ? {
    nombre: producto.nombre, descripcion: producto.descripcion || "", precio: String(producto.precio),
    categoria: producto.categoria, atributos: producto.atributos || {}, publicado: producto.publicado,
  } : VACIO));
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const campos = erroresPorCampo(error);
  const cambiar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const cambiarAtributo = (clave) => (e) => setForm((f) => ({ ...f, atributos: { ...f.atributos, [clave]: e.target.value } }));

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    const atributos = Object.fromEntries((ATRIBUTOS[form.categoria] || [])
      .map(([k]) => [k, String(form.atributos[k] ?? "").trim()]).filter(([, v]) => v));
    const cuerpo = { nombre: form.nombre, descripcion: form.descripcion, precio: Number(form.precio), categoria: form.categoria, atributos };
    try {
      if (producto) {
        await api(`/productos/${producto.id}`, { metodo: "PUT", cuerpo });
        avisar(`Guardaste los cambios de ${form.nombre}`, "exito");
      } else {
        await api("/productos", { metodo: "POST", cuerpo: { ...cuerpo, publicado: form.publicado } });
        avisar(`Publicaste ${form.nombre}. Carga su stock en Inventario.`, "exito");
      }
      alGuardar();
    } catch (err) {
      setError(err);
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    try {
      await api(`/productos/${producto.id}`, { metodo: "DELETE" });
      avisar(`Eliminaste ${producto.nombre}`, "exito");
      alGuardar();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <form className="pila" onSubmit={guardar} noValidate>
      {error && !Object.keys(campos).length && <CajaError error={error} />}
      <Campo error={campos.nombre} etiqueta="Nombre">
        <input className="entrada" value={form.nombre} onChange={cambiar("nombre")} maxLength={120} required />
      </Campo>
      <Campo error={campos.descripcion} etiqueta="Descripción">
        <textarea className="entrada" value={form.descripcion} onChange={cambiar("descripcion")} maxLength={2000} />
      </Campo>
      <div className="vend-dos-columnas">
        <Campo error={campos.precio} etiqueta="Precio en pesos" ayuda={form.precio ? pesos(form.precio) : "Sin decimales"}>
          <input className="entrada" value={form.precio} onChange={cambiar("precio")} inputMode="numeric" type="number" min="1" step="1" required />
        </Campo>
        <Campo error={campos.categoria} etiqueta="Categoría">
          <select className="selector" value={form.categoria} onChange={cambiar("categoria")} required>
            <option value="">Elige una</option>
            {categorias.map((c) => <option key={c.slug} value={c.slug}>{c.nombre}</option>)}
          </select>
        </Campo>
      </div>
      {ATRIBUTOS[form.categoria] && (
        <fieldset className="vend-atributos">
          <legend>Detalles de {categorias.find((c) => c.slug === form.categoria)?.nombre.toLowerCase()}</legend>
          <div className="vend-dos-columnas">
            {ATRIBUTOS[form.categoria].map(([clave, etiqueta]) => (
              <Campo key={clave} error={campos[`atributos.${clave}`]} etiqueta={etiqueta}>
                <input className="entrada" value={form.atributos[clave] ?? ""} onChange={cambiarAtributo(clave)} maxLength={120} />
              </Campo>
            ))}
          </div>
        </fieldset>
      )}
      {!producto && (
        <label className="vend-interruptor">
          <input type="checkbox" checked={form.publicado} onChange={(e) => setForm((f) => ({ ...f, publicado: e.target.checked }))} />
          <span>Publicar en la plaza al guardar</span>
        </label>
      )}
      <div className="fila entre vend-dialogo-acciones">
        {producto ? (
          confirmarBorrado ? (
            <span className="fila">
              <span>¿Eliminar este producto de la plaza?</span>
              <button type="button" className="boton boton-sm vend-boton-peligro" onClick={eliminar}>Sí, eliminar</button>
              <button type="button" className="boton boton-plano boton-sm" onClick={() => setConfirmarBorrado(false)}>No</button>
            </span>
          ) : (
            <button type="button" className="boton boton-plano boton-sm" onClick={() => setConfirmarBorrado(true)}>
              <Icono nombre="basura" tamano={18} /> Eliminar producto
            </button>
          )
        ) : <span />}
        <span className="fila">
          <button type="button" className="boton boton-plano" onClick={alCerrar}>Cancelar</button>
          <button className="boton boton-primario" disabled={guardando}>{guardando ? "Guardando…" : producto ? "Guardar cambios" : "Publicar producto"}</button>
        </span>
      </div>
    </form>
  );
}

export default function Productos() {
  const { avisar } = usePlaza();
  const productos = useCarga(() => api("/productos?mios=1&porPagina=60&orden=recientes").then((r) => r.datos), []);
  const { datos: categorias } = useCarga(() => api("/categorias").then((r) => r.datos), []);
  const [editando, setEditando] = useState(null);

  async function alternarPublicacion(p) {
    try {
      await api(`/productos/${p.id}/publicacion`, { metodo: "PATCH", cuerpo: { publicado: !p.publicado } });
      avisar(p.publicado ? `Ocultaste ${p.nombre}` : `Publicaste ${p.nombre}`, "exito");
      productos.recargar();
    } catch (err) {
      avisar(err.message, "error");
    }
  }

  const lista = productos.datos || [];
  return (
    <div className="pila" style={{ "--pila": "20px" }}>
      <div className="fila entre">
        <div>
          <h2>Tus productos</h2>
          <p className="secundario">{lista.filter((p) => p.publicado).length} publicados, {lista.filter((p) => !p.publicado).length} ocultos</p>
        </div>
        <button className="boton boton-primario" onClick={() => setEditando({})} disabled={!categorias}>
          <Icono nombre="mas" /> Nuevo producto
        </button>
      </div>

      {productos.error && <CajaError error={productos.error} alReintentar={productos.recargar} />}
      {productos.cargando ? <Cargando alto={88} filas={4} /> : lista.length === 0 ? (
        <Vacio titulo="Tu puesto aún no tiene productos" accion={<button className="boton boton-primario" onClick={() => setEditando({})}>Publicar el primero</button>}>
          Publica un producto y luego carga sus unidades en Inventario.
        </Vacio>
      ) : (
        <ul className="vend-productos">
          {lista.map((p) => (
            <li key={p.id} className={p.publicado ? "" : "vend-oculto"}>
              <img src={urlRecurso(p.imagenes?.[0])} alt="" loading="lazy" width="72" height="72" />
              <div className="vend-producto-info">
                <Link to={`/productos/${p.id}`}><strong>{p.nombre}</strong></Link>
                <span className="secundario">{categorias?.find((c) => c.slug === p.categoria)?.nombre || p.categoria}</span>
              </div>
              <span className="cifra">{pesos(p.precio)}</span>
              <span className="vend-producto-estado">
                <Sello stock={p.estadoStock} plano>{p.estadoStock === "agotado" ? "Sin stock" : `${p.stockDisponible ?? 0} disp.`}</Sello>
                {!p.publicado && <Sello tono="neutro" plano>Oculto</Sello>}
              </span>
              <span className="fila vend-producto-acciones">
                <button className="boton boton-plano boton-sm" onClick={() => alternarPublicacion(p)} aria-label={`${p.publicado ? "Ocultar" : "Publicar"} ${p.nombre}`}>
                  <Icono nombre={p.publicado ? "ojo-tachado" : "ojo"} tamano={18} /> {p.publicado ? "Ocultar" : "Publicar"}
                </button>
                <button className="boton boton-sm" onClick={() => setEditando(p)} aria-label={`Editar ${p.nombre}`}>
                  <Icono nombre="lapiz" tamano={18} /> Editar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Dialogo abierto={editando !== null} alCerrar={() => setEditando(null)} titulo={editando?.id ? `Editar ${editando.nombre}` : "Nuevo producto"}>
        {editando !== null && categorias && (
          <FormularioProducto key={editando.id || "nuevo"} producto={editando.id ? editando : null} categorias={categorias}
            alCerrar={() => setEditando(null)} alGuardar={() => { setEditando(null); productos.recargar(); }} />
        )}
      </Dialogo>
    </div>
  );
}
