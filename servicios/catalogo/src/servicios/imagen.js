// Ilustración SVG generada por producto (sin enlaces externos que puedan caerse).
// Dibujo plano según la categoría, sobre el color del puesto. Sin texto del
// usuario dentro del SVG: así no hay riesgo de inyección.

const HEX = /^#[0-9A-Fa-f]{6}$/;

// Número estable a partir del id: el mismo producto siempre se ve igual.
function semilla(texto) {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return Math.abs(h);
}

const TINTA = "#15181C";
const CREMA = "#F4F3EF";
const ACENTOS = ["#E4572E", "#F2C14E", "#F4F3EF", "#16324F", "#9BD1B5"];

const DIBUJOS = {
  tecnologia: (a) => `
    <rect x="120" y="80" width="160" height="104" rx="8" fill="${TINTA}"/>
    <rect x="130" y="90" width="140" height="84" rx="3" fill="${a}"/>
    <path d="M96 196h208l-16 22H112z" fill="${CREMA}" stroke="${TINTA}" stroke-width="4" stroke-linejoin="round"/>
    <rect x="182" y="200" width="36" height="5" rx="2" fill="${TINTA}"/>`,
  bicicletas: (a) => `
    <circle cx="130" cy="186" r="44" fill="none" stroke="${TINTA}" stroke-width="9"/>
    <circle cx="270" cy="186" r="44" fill="none" stroke="${TINTA}" stroke-width="9"/>
    <path d="M130 186l48-70h70l22 70M178 116l30 70h-78M248 116l-40 70" fill="none" stroke="${a}" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M166 104h28M240 100l14-4" stroke="${TINTA}" stroke-width="9" stroke-linecap="round"/>`,
  ropa: (a) => `
    <path d="M160 70l-56 30 18 44 26-12v104h104V132l26 12 18-44-56-30c-6 16-22 26-40 26s-34-10-40-26z"
      fill="${a}" stroke="${TINTA}" stroke-width="5" stroke-linejoin="round"/>
    <path d="M168 150h64M168 172h64" stroke="${TINTA}" stroke-width="4" stroke-dasharray="6 8" opacity=".5"/>`,
  hogar: (a) => `
    <path d="M150 70h100l30 74H120z" fill="${a}" stroke="${TINTA}" stroke-width="5" stroke-linejoin="round"/>
    <rect x="194" y="144" width="12" height="70" fill="${TINTA}"/>
    <rect x="156" y="212" width="88" height="14" rx="6" fill="${TINTA}"/>
    <circle cx="200" cy="150" r="10" fill="#F2C14E"/>`,
  artesanias: (a) => `
    <ellipse cx="200" cy="186" rx="130" ry="34" fill="${CREMA}" stroke="${TINTA}" stroke-width="5"/>
    <path d="M140 182c0-62 26-98 60-98s60 36 60 98" fill="${CREMA}" stroke="${TINTA}" stroke-width="5"/>
    <path d="M146 150h108M144 166h112M152 130h96M162 110h76" stroke="${TINTA}" stroke-width="6" stroke-dasharray="10 6"/>
    <ellipse cx="200" cy="190" rx="104" ry="20" fill="none" stroke="${a}" stroke-width="6" stroke-dasharray="12 6"/>`,
  papeleria: (a) => `
    <rect x="128" y="64" width="120" height="164" rx="6" fill="${a}" stroke="${TINTA}" stroke-width="5"/>
    <g fill="${CREMA}" stroke="${TINTA}" stroke-width="3">${[84, 112, 140, 168, 196].map((y) => `<circle cx="128" cy="${y}" r="7"/>`).join("")}</g>
    <rect x="152" y="96" width="72" height="14" rx="3" fill="${CREMA}"/>
    <path d="M272 220l16-120 14 4-16 120-10 14z" fill="#F2C14E" stroke="${TINTA}" stroke-width="4" stroke-linejoin="round"/>`,
  deportes: (a) => `
    <circle cx="200" cy="150" r="78" fill="${CREMA}" stroke="${TINTA}" stroke-width="6"/>
    <path d="M200 116l32 23-12 38h-40l-12-38z" fill="${TINTA}"/>
    <path d="M200 116V72M232 139l40-14M220 177l26 36M180 177l-26 36M168 139l-40-14" stroke="${TINTA}" stroke-width="5"/>
    <circle cx="200" cy="150" r="78" fill="none" stroke="${a}" stroke-width="4" stroke-dasharray="4 10"/>`,
};

export function generarImagen({ id, categoria, colorTienda }) {
  const s = semilla(id);
  const fondo = HEX.test(colorTienda || "") ? colorTienda : "#E4572E";
  const acento = ACENTOS[s % ACENTOS.length] === fondo ? ACENTOS[(s + 1) % ACENTOS.length] : ACENTOS[s % ACENTOS.length];
  const giro = (s % 13) - 6; // -6° … 6°: productos de la misma categoría no se ven idénticos
  const dibujo = (DIBUJOS[categoria] || DIBUJOS.hogar)(acento);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-hidden="true">
  <defs><pattern id="r" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(${30 + giro * 4})">
    <rect width="22" height="22" fill="${fondo}"/><path d="M0 0v22" stroke="#000" stroke-opacity=".07" stroke-width="8"/></pattern></defs>
  <rect width="400" height="300" fill="url(#r)"/>
  <circle cx="${120 + (s % 160)}" cy="${80 + (s % 120)}" r="${110 + (s % 40)}" fill="#fff" fill-opacity=".14"/>
  <ellipse cx="200" cy="246" rx="120" ry="12" fill="#000" fill-opacity=".14"/>
  <g transform="rotate(${giro} 200 150)">${dibujo}</g>
</svg>`;
}
