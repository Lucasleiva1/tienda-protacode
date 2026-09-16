import { ProductCard } from "@/components/products/ProductCard";
import { pick, type Locale } from "@/i18n/shared";
import type { Product } from "@/types/product";

interface RelatedProductsProps {
  readonly products: readonly Product[];
  readonly locale: Locale;
}

/**
 * Otros programas.
 *
 * Lista corta y quieta: sin carrusel ni rotación automática. Si no hay otros
 * productos publicados, la sección no existe.
 */
export function RelatedProducts({ products, locale }: RelatedProductsProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="otros">
      <h2 id="otros" className="display text-3xl sm:text-4xl">
        {pick(locale, "Otros programas", "Other programs", "Outros programas")}
      </h2>

      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((producto) => (
          <li key={producto.id} className="relative">
            <ProductCard product={producto} locale={locale} />
          </li>
        ))}
      </ul>
    </section>
  );
}
