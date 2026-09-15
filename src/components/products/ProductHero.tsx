import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { ProductGallery } from "@/components/products/ProductGallery";
import {
  categoryLabel,
  platformsLabel,
  primaryPrice,
  secondaryPrice,
} from "@/features/products/format";
import type { Product } from "@/types/product";

interface ProductHeroProps {
  readonly product: Product;
}

/**
 * Encabezado de la ficha: la sección más fuerte de la página.
 *
 * A la izquierda la imagen del programa cuando existe; a la derecha el bloque
 * comercial completo. Si todavía no hay capturas, la columna de imagen no se dibuja
 * y el texto ocupa el ancho: nunca se rellena con un mockup inventado.
 */
export function ProductHero({ product }: ProductHeroProps) {
  const imagenes =
    product.images.length > 0
      ? product.images
      : product.heroImage !== null
        ? [product.heroImage]
        : [];

  const tieneImagenes = imagenes.length > 0;

  return (
    <div
      className={
        tieneImagenes
          ? "grid gap-12 lg:grid-cols-[1.1fr_1fr] lg:gap-16"
          : "max-w-3xl"
      }
    >
      {tieneImagenes ? (
        <ProductGallery images={imagenes} productName={product.name} />
      ) : null}

      <div>
        <p className="eyebrow text-accent-contrast">
          {categoryLabel(product.category)}
        </p>

        <h1 className="display mt-4 text-5xl sm:text-6xl">{product.name}</h1>

        <p className="mt-5 text-lg leading-relaxed text-muted">
          {product.shortDescription}
        </p>

        <p className="eyebrow mt-6">
          {platformsLabel(product.platforms)}
          <span className="px-2 text-border">·</span>
          versión {product.version}
        </p>

        <div className="mt-9 border-t border-border pt-7">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <p className="display text-5xl">{primaryPrice(product)}</p>
            <p className="pb-1 text-sm text-muted">{secondaryPrice(product)}</p>
          </div>

          <ul className="mt-5 flex flex-wrap gap-2">
            {["Pago único", "Sin suscripción"].map((sello) => (
              <li
                key={sello}
                className="eyebrow border border-accent/40 px-3 py-1.5 text-accent-contrast"
              >
                {sello}
              </li>
            ))}
            <li className="eyebrow border border-border px-3 py-1.5">
              Licencia permanente para esta versión
            </li>
          </ul>

          <AddToCartButton product={product} className="mt-7 w-full sm:w-auto" />

          <p className="mt-4 text-xs leading-relaxed text-muted">
            La compra corresponde a la versión indicada en esta página.
          </p>
        </div>
      </div>
    </div>
  );
}
