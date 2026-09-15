import "server-only";
import { getProductRepository } from "@/features/products/product-repository";
import { CATEGORIES, type Category, type Product } from "@/types/product";

/**
 * Consultas de productos para la parte pública.
 *
 * Toda la tienda pasa por acá y nunca lee el almacenamiento directamente. Los datos
 * salen del `ProductRepository`, que es lo que administra el Admin: agregar un
 * programa desde /admin alcanza para que aparezca en la tienda, sin tocar código.
 *
 * Son asíncronas porque leer del almacén lo es. Las páginas son componentes de
 * servidor, así que simplemente las esperan.
 */

/** Todos, incluidos ocultos y archivados. Uso interno / Admin. */
export function getProducts(): Promise<readonly Product[]> {
  return getProductRepository().findAll();
}

/**
 * Lo que ve el público: publicados, no archivados, ordenados por `sortOrder`.
 *
 * Es la consulta que usan la Home, el catálogo, el carrito y el checkout.
 */
export function getPublishedProducts(): Promise<readonly Product[]> {
  return getProductRepository().findPublished();
}

/**
 * Los destacados.
 *
 * Sale de los publicados, así que `featured` nunca puede meter en la portada un
 * programa oculto o archivado. `featured` decide si además va a la sección
 * destacada; NO decide si aparece en el catálogo.
 */
export async function getFeaturedProducts(): Promise<readonly Product[]> {
  const publicados = await getPublishedProducts();
  return publicados.filter((producto) => producto.featured);
}

/**
 * Busca por slug entre los publicados.
 *
 * A propósito no encuentra ocultos ni archivados: es lo que consumen la ficha
 * pública y el checkout, y devolver uno retirado sería venderlo.
 */
export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const publicados = await getPublishedProducts();
  return publicados.find((producto) => producto.slug === slug);
}

/** Categorías realmente en uso. Evita filtros que no devuelven nada. */
export async function getUsedCategories(): Promise<readonly Category[]> {
  const publicados = await getPublishedProducts();
  const enUso = new Set(publicados.map((producto) => producto.category));
  return CATEGORIES.filter((categoria) => enUso.has(categoria));
}

/** Otros programas para el pie de una ficha. Prioriza la misma categoría. */
export async function getRelatedProducts(
  slug: string,
  limite = 3,
): Promise<readonly Product[]> {
  const publicados = await getPublishedProducts();
  const actual = publicados.find((producto) => producto.slug === slug);
  const otros = publicados.filter((producto) => producto.slug !== slug);

  if (actual === undefined) return otros.slice(0, limite);

  const misma = otros.filter((p) => p.category === actual.category);
  const resto = otros.filter((p) => p.category !== actual.category);
  return [...misma, ...resto].slice(0, limite);
}
