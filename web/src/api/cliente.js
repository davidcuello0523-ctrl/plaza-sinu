export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
const CLAVE_SESION = "plaza.sesion";

export class ErrorApi extends Error {
  constructor(status, cuerpo) {
    const e = cuerpo?.error || {};
    super(e.mensaje || `Error ${status}`);
    this.status = status;
    this.codigo = e.codigo;
    this.detalles = e.detalles || [];
    this.correlationId = e.correlationId;
  }
}

export const sesionGuardada = {
  leer() {
    try { return JSON.parse(localStorage.getItem(CLAVE_SESION)) || null; } catch { return null; }
  },
  guardar(sesion) {
    try { localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion)); } catch {}
    window.dispatchEvent(new Event("plaza:sesion"));
  },
  borrar() {
    try { localStorage.removeItem(CLAVE_SESION); } catch {}
    window.dispatchEvent(new Event("plaza:sesion"));
  },
};

let renovando = null;
async function renovarSesion() {
  const actual = sesionGuardada.leer();
  if (!actual?.refreshToken) return null;
  renovando ??= fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken: actual.refreshToken }),
  })
    .then(async (r) => {
      if (!r.ok) { sesionGuardada.borrar(); return null; }
      const nueva = await r.json();
      sesionGuardada.guardar(nueva);
      return nueva;
    })
    .finally(() => { renovando = null; });
  return renovando;
}

export async function api(ruta, { metodo = "GET", cuerpo, headers = {}, reintento = true } = {}) {
  const sesion = sesionGuardada.leer();
  const res = await fetch(API_URL + ruta, {
    method: metodo,
    headers: {
      ...(cuerpo !== undefined && { "content-type": "application/json" }),
      ...(sesion?.accessToken && { authorization: `Bearer ${sesion.accessToken}` }),
      ...headers,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  }).catch(() => {
    throw new ErrorApi(0, { error: { mensaje: "No hay conexión con Plaza Sinú. Revisa que el gateway esté arriba." } });
  });

  if (res.status === 401 && reintento && sesion?.refreshToken && !ruta.startsWith("/auth/")) {
    const nueva = await renovarSesion();
    if (nueva) return api(ruta, { metodo, cuerpo, headers, reintento: false });
  }
  if (res.status === 204) return null;
  const datos = await res.json().catch(() => null);
  if (!res.ok) throw new ErrorApi(res.status, datos);
  return datos;
}

export const urlRecurso = (ruta) => (!ruta ? "" : ruta.startsWith("http") ? ruta : API_URL + ruta);

export function abrirStream(ruta) {
  const token = sesionGuardada.leer()?.accessToken;
  return new EventSource(`${API_URL}${ruta}?token=${encodeURIComponent(token || "")}`);
}
