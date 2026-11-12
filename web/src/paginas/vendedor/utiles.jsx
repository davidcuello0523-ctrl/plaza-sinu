// Utilidades locales de la zona Mi Puesto.
import { useCallback, useEffect, useRef, useState } from "react";
import Icono from "../../componentes/Icono.jsx";

// Carga datos de la API con estado de carga/error y una función para recargar.
export function useCarga(cargarDatos, deps) {
  const [estado, setEstado] = useState({ cargando: true, datos: null, error: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recargar = useCallback(async () => {
    try {
      setEstado((e) => ({ ...e, cargando: e.datos === null, error: null }));
      setEstado({ cargando: false, datos: await cargarDatos(), error: null });
    } catch (error) {
      setEstado((e) => ({ ...e, cargando: false, error }));
    }
  }, deps);
  useEffect(() => { recargar(); }, [recargar]);
  return { ...estado, recargar };
}

// Diálogo modal accesible: <dialog> nativo con showModal() deja inerte el resto
// de la página (atrapa el foco) y se cierra con Esc.
export function Dialogo({ abierto, alCerrar, titulo, children, ancho = 640, lateral = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);
  return (
    <dialog ref={ref} className={`vend-dialogo ${lateral ? "vend-dialogo-lateral" : ""}`} style={{ "--ancho": `${ancho}px` }}
      onClose={alCerrar} aria-labelledby="vend-dialogo-titulo">
      {abierto && (
        <>
          <div className="vend-dialogo-cabeza">
            <h2 id="vend-dialogo-titulo">{titulo}</h2>
            <button className="boton boton-plano boton-icono" onClick={alCerrar} aria-label="Cerrar"><Icono nombre="x" /></button>
          </div>
          <div className="vend-dialogo-cuerpo">{children}</div>
        </>
      )}
    </dialog>
  );
}

// Errores 422 por campo → { campo: mensaje }
export const erroresPorCampo = (error) =>
  Object.fromEntries((error?.detalles || []).filter((d) => d.campo).map((d) => [d.campo, d.mensaje]));
