import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const DIR_FOTOS = fileURLToPath(new URL("../fotos/", import.meta.url));
export const FOTOS = new Set(readdirSync(DIR_FOTOS).filter((f) => /^prd-\d{3}\.jpg$/.test(f)).map((f) => f.slice(0, 7)));
export const rutaFoto = (id) => `/productos/${id}/foto.jpg`;
