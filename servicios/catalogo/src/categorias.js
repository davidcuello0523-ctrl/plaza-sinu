export const CATEGORIAS = [
  { slug: "tecnologia", nombre: "Tecnología" },
  { slug: "bicicletas", nombre: "Bicicletas y accesorios" },
  { slug: "ropa", nombre: "Ropa" },
  { slug: "hogar", nombre: "Hogar" },
  { slug: "artesanias", nombre: "Artesanías" },
  { slug: "papeleria", nombre: "Papelería" },
  { slug: "deportes", nombre: "Deportes" },
];
export const SLUGS_CATEGORIA = CATEGORIAS.map((c) => c.slug);

export const UMBRAL_STOCK = 3;
export const estadoDeStock = (disponible, umbral = UMBRAL_STOCK) =>
  disponible <= 0 ? "agotado" : disponible <= umbral ? "ultimas_unidades" : "disponible";
