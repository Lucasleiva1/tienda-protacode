import Image from "next/image";
import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Icons";
import {
  categoryLabel,
  platformsLabel,
  primaryPrice,
  secondaryPrice,
} from "@/features/products/format";
import type { Product } from "@/types/product";

interface ProductCardProps {
  readonly product: Product;
  /** Índice en el listado. Se muestra como numeración del catálogo. */
  readonly index?: number;
}

/**
 * Entrada del catálogo.
 *
 * No es una tarjeta de SaaS: es una ficha de catálogo técnico. Filo de color
 * arriba, la categoría como etiqueta, el nombre grande en condensada, y al pie una
 * franja separada con los datos comerciales. El nombre manda por tamaño; el precio
 * acompaña, no compite.
 *
 * La imagen aparece sola cuando el producto la tiene. Mientras no exista un archivo
 * real, la ficha se apoya en la tipografía en vez de mostrar un recuadro vacío.
 */
export function ProductCard({ product, index }: ProductCardProps) {
  return (
    <article className="group flex h-full flex-col border border-border bg-surface transition-colors hover:border-accent/50">
      <div aria-hidden="true" className="h-px bg-accent/70" />

      {product.heroImage !== null ? (
        <Image
          src={product.heroImage.src}
          alt={product.heroImage.alt}
          width={640}
          height={400}
          sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
          loading="lazy"
          className="aspect-[8/5] w-full border-b border-border object-cover"
        />
      ) : null}

      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center justify-between gap-4">
          <span className="eyebrow text-accent-contrast">
            {categoryLabel(product.category)}
          </span>
          {index !== undefined ? (
            <span className="eyebrow">{String(index + 1).padStart(2, "0")}</span>
          ) : null}
        </div>

        <h3 className="display mt-4 text-3xl">
          <Link
            href={`/programas/${product.slug}`}
            className="transition-colors before:absolute before:inset-0 group-hover:text-accent-contrast"
          >
            {product.name}
          </Link>
        </h3>

        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
          {product.shortDescription}
        </p>

        <p className="eyebrow mt-6">
          {platformsLabel(product.platforms)}
          <span className="px-2 text-border">·</span>
          versión {product.version}
        </p>
      </div>

      <div className="flex flex-col items-start gap-4 border-t border-border px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <p className="text-xl font-semibold tracking-tight">
            {primaryPrice(product)}
          </p>
          <p className="mt-0.5 text-xs text-muted">{secondaryPrice(product)}</p>
          <p className="eyebrow mt-2 text-accent-contrast">Pago único</p>
        </div>

        <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
          Ver programa
          <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}
