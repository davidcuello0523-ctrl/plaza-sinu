// Utilidades de las pruebas E2E: llamadas al gateway, esperas y reporte ✅/❌.
import { writeFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

export const GATEWAY = process.env.GATEWAY_URL || "http://localhost:8080";
export const CLAVE = "Demo123*";

export async function api(metodo, ruta, { token, cuerpo, headers = {} } = {}) {
  const res = await fetch(GATEWAY + ruta, {
    method: metodo,
    headers: {
      "content-type": "application/json",
      ...(token && { authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = texto; }
  return { status: res.status, datos, correlationId: res.headers.get("x-correlation-id") };
}

export async function login(email) {
  const r = await api("POST", "/auth/login", { cuerpo: { email, clave: CLAVE } });
  if (r.status !== 200) throw new Error(`login ${email} → ${r.status} ${JSON.stringify(r.datos)}`);
  return r.datos.accessToken;
}

// Espera a que una condición asíncrona se cumpla (consistencia eventual).
export async function esperar(fn, { msMax = 8000, cada = 300 } = {}) {
  const fin = Date.now() + msMax;
  let ultimo;
  while (Date.now() < fin) {
    ultimo = await fn();
    if (ultimo) return ultimo;
    await new Promise((r) => setTimeout(r, cada));
  }
  return ultimo;
}

export const nuevaClave = () => randomUUID();

export function crearReporte(titulo) {
  const casos = [];
  return {
    verificar(nombre, ok, detalle = "") {
      casos.push({ nombre, ok: Boolean(ok), detalle });
      console.log(`${ok ? "✅" : "❌"} ${nombre}${detalle ? `  — ${detalle}` : ""}`);
    },
    guardar(archivo) {
      const fallidos = casos.filter((c) => !c.ok).length;
      const md = [
        `# ${titulo}`,
        "",
        `Ejecutado: ${new Date().toLocaleString("es-CO")} · Gateway: ${GATEWAY}`,
        "",
        `**Resultado: ${casos.length - fallidos}/${casos.length} casos correctos**`,
        "",
        "| # | Caso | Resultado | Detalle |",
        "|---|---|---|---|",
        ...casos.map((c, i) => `| ${i + 1} | ${c.nombre} | ${c.ok ? "✅" : "❌"} | ${String(c.detalle).replace(/\|/g, "\\|")} |`),
        "",
      ].join("\n");
      mkdirSync("docs/pruebas", { recursive: true });
      writeFileSync(archivo, md);
      console.log(`\n${casos.length - fallidos}/${casos.length} correctos → ${archivo}`);
      return fallidos;
    },
  };
}
