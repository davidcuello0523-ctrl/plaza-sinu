// Utilidades de La Plaza: carga de datos y textos amigables.
import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/cliente.js";

// Carga una ruta del gateway y expone { datos, error, cargando, recargar }.
export function useDatos(ruta) {
  const [estado, setEstado] = useState({ datos: null, error: null, cargando: Boolean(ruta) });
  const recargar = useCallback(async () => {
    if (!ruta) return;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    try { setEstado({ datos: await api(ruta), error: null, cargando: false }); }
    catch (error) { setEstado({ datos: null, error, cargando: false }); }
  }, [ruta]);
  useEffect(() => { recargar(); }, [recargar]);
  return { ...estado, recargar };
}

export const iniciales = (nombre = "") =>
  nombre.replace(/&/g, "").split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export const NOMBRES_CATEGORIA = {
  tecnologia: "Tecnología", bicicletas: "Bicicletas y accesorios", ropa: "Ropa", hogar: "Hogar",
  artesanias: "Artesanías", papeleria: "Papelería", deportes: "Deportes",
};

// Etiquetas legibles para los atributos variables de cada categoría.
const ETIQUETAS = {
  marca: "Marca", memoria: "Memoria", voltaje: "Voltaje", garantiaMeses: "Garantía", rin: "Rin", talla: "Talla",
  material: "Material", cambios: "Cambios", color: "Color", medidas: "Medidas", tecnica: "Técnica",
  origen: "Origen", vueltas: "Vueltas", presentacion: "Presentación", unidades: "Unidades", deporte: "Deporte",
};
export function atributoLegible(clave, valor) {
  const etiqueta = ETIQUETAS[clave] || clave.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  let texto = typeof valor === "boolean" ? (valor ? "Sí" : "No") : String(valor);
  if (clave === "garantiaMeses") texto = `${valor} meses`;
  if (clave === "vueltas") texto = `${valor} vueltas`;
  return [etiqueta, texto];
}
