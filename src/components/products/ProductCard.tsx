import Image from "next/image";
import Link from "next/link";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { ArrowIcon, DownloadIcon } from "@/components/ui/Icons";
import {
  categoryLabel,
  isFree,
  platformsLabel,
  priceLabel,
  secondaryPriceLabel,
} from "@/features/products/format";
import { localizeProduct } from "@/i18n/product-copy";
import { pick, type Locale } from "@/i18n/shared";
import type { Product } from "@/types/product";

interface ProductCardProps {
  readonly product: Product;
  readonly index?: number;
  readonly locale?: Locale;
}

export function ProductCard({ product, index, locale = "es" }: ProductCardProps) {
  const shown = localizeProduct(product, locale);
  const gratuito = isFree(product);
  const segundoPrecio = secondaryPriceLabel(shown, locale);
  return (
    <article className="group flex h-full min-w-0 flex-col overflow-hidden border border-border bg-surface transition-colors hover:border-accent/60">
      <div className="relative aspect-[5/4] w-full overflow-hidden border-b border-border bg-background">
        {shown.heroImage !== null ? (
          <Image
            src={shown.heroImage.src}
            alt={shown.heroImage.alt}
            fill
            sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 100vw"
            loading="lazy"
            className="bg-foreground object-contain p-3"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-4 flex items-center justify-center border border-border/70 bg-gradient-to-br from-background via-surface to-background px-8 text-center"
          >
            <span className="display text-4xl text-foreground/30">{shown.name}</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <span className="eyebrow text-accent-contrast">
            {categoryLabel(shown.category, locale)}
          </span>
          {index !== undefined ? (
            <span className="eyebrow">{String(index + 1).padStart(2, "0")}</span>
          ) : null}
        </div>
        <h3 className="display mt-4 text-3xl sm:text-[2rem]">
          <Link
            href={"/programas/" + product.slug}
            className="transition-colors group-hover:text-accent-contrast"
          >
            {shown.name}
          </Link>
        </h3>
        <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">
          {shown.shortDescription}
        </p>
        <p className="eyebrow mt-6">
          {platformsLabel(shown.platforms)}
          <span className="px-2 text-border">·</span>
          {pick(locale, "versión", "version", "versão")} {shown.version}
        </p>
      </div>
      <div className="border-t border-border px-5 py-5 sm:px-6">
        <p className="eyebrow text-accent-contrast">
          {gratuito
            ? pick(locale, "Descarga · gratis", "Download · free", "Download · grátis")
            : pick(locale, "Precio · pago único", "Price · one-time payment", "Preço · pagamento único")}
        </p>
        <p className="display mt-2 text-3xl">{priceLabel(shown, locale)}</p>
        {segundoPrecio !== null ? (
          <p className="mt-1 text-xs text-muted">{segundoPrecio}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2 border-t border-border p-5 sm:p-6">
        <Link
          href={"/programas/" + product.slug}
          className="inline-flex min-h-12 min-w-[120px] flex-1 items-center justify-center gap-2 border border-border px-3 text-sm font-medium text-foreground transition-colors hover:border-accent/70 hover:bg-background"
        >
          {pick(locale, "Ver producto", "View product", "Ver produto")}
          <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
        {gratuito ? (
          /* Un gratuito no va al carrito: la descarga vive en su ficha. */
          <Link
            href={"/programas/" + product.slug}
            className="inline-flex min-h-12 min-w-[120px] flex-1 items-center justify-center gap-2 bg-accent px-3 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-contrast"
          >
            <DownloadIcon className="h-4 w-4" />
            {pick(locale, "Descargar gratis", "Download for free", "Baixar grátis")}
          </Link>
        ) : (
          <AddToCartButton
            product={shown}
            compact
            locale={locale}
            className="min-w-[120px] flex-1"
          />
        )}
      </div>
    </article>
  );
}
