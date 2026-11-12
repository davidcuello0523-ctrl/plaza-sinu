const TRAZOS = {
  buscar: <><circle cx="10.5" cy="10.5" r="6" /><path d="M15 15l5 5" /></>,
  carrito: <><path d="M3 4h2.5l2.2 10.5h10.6L20.5 7H7" /><circle cx="9.5" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></>,
  campana: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  usuario: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  ubicacion: <><path d="M12 21s-6.5-6.1-6.5-11a6.5 6.5 0 0 1 13 0c0 4.9-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>,
  puesto: <><path d="M3 9h18l-1.5-4.5h-15z" /><path d="M3 9c0 1.4 1.1 2.5 2.5 2.5S8 10.4 8 9c0 1.4 1.1 2.5 2.5 2.5S13 10.4 13 9c0 1.4 1.1 2.5 2.5 2.5S18 10.4 18 9c0 1.4 1.1 2.5 2.5 2.5" /><path d="M5 12v8h14v-8M10 20v-4.5h4V20" /></>,
  caja: <><path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9" /></>,
  camion: <><path d="M2.5 6h11v10h-11zM13.5 9.5h4l3 3.5v3h-7" /><circle cx="6.5" cy="17.5" r="1.6" /><circle cx="17" cy="17.5" r="1.6" /></>,
  check: <path d="M4.5 12.5l5 5 10-11" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  mas: <path d="M12 5v14M5 12h14" />,
  menos: <path d="M5 12h14" />,
  atras: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  adelante: <path d="M9.5 5.5L16 12l-6.5 6.5" />,
  engranaje: <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3" /></>,
  rayo: <path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z" />,
  servidor: <><rect x="4" y="4" width="16" height="6.5" rx="1.5" /><rect x="4" y="13.5" width="16" height="6.5" rx="1.5" /><path d="M8 7.25h.01M8 16.75h.01" /></>,
  grafica: <><path d="M4 20V4M4 20h16" /><path d="M7.5 15l4-4.5 3 3L19 8" /></>,
  salir: <><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  lapiz: <><path d="M4 20l1-4.5L16 4.5l3.5 3.5-11 11z" /><path d="M13.5 7l3.5 3.5" /></>,
  ojo: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="2.8" /></>,
  "ojo-tachado": <><path d="M2.5 12S6 5.5 12 5.5c2 0 3.7.7 5.1 1.6M21.5 12s-3.5 6.5-9.5 6.5c-2 0-3.7-.7-5.1-1.6" /><path d="M4 20L20 4" /></>,
  basura: <><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></>,
  filtro: <path d="M3.5 5h17l-6.5 8v6l-4 1.5V13z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  tarjeta: <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M6 15h4" /></>,
  alerta: <><path d="M12 3.5L2.5 20h19z" /><path d="M12 10v4.5M12 17.2h.01" /></>,
  reloj: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  estrella: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />,
  mapa: <><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M8.2 7.2l2.6 8.6M15.8 7.2l-2.6 8.6M8.5 6h7" /></>,
  radar: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><path d="M12 12l6-6" /></>,
  presentacion: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><path d="M12 16v4M8 20h8M7 12l3-3 2.5 2.5L17 7" /></>,
  documento: <><path d="M6 3h8.5L19 7.5V21H6z" /><path d="M14 3v5h5M9 13h7M9 17h5" /></>,
};

export default function Icono({ nombre, tamano = 20, titulo, className = "" }) {
  return (
    <svg
      className={`icono ${className}`}
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={titulo ? undefined : true}
      role={titulo ? "img" : undefined}
    >
      {titulo && <title>{titulo}</title>}
      {TRAZOS[nombre] || TRAZOS.caja}
    </svg>
  );
}
