// Categorías del marketplace (lista fija: cambian muy poco y no justifican una colección).
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

// Misma regla que usa inventario (docs/contratos.md): agotado / últimas unidades / disponible.
export const UMBRAL_STOCK = 3;
export const estadoDeStock = (disponible, umbral = UMBRAL_STOCK) =>
  disponible <= 0 ? "agotado" : disponible <= umbral ? "ultimas_unidades" : "disponible";
