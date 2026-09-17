import Link from "next/link";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { FreeDownloadButton } from "@/components/products/FreeDownloadButton";
import { FreeLicenseButton } from "@/components/products/FreeLicenseButton";
import { ProductGallery } from "@/components/products/ProductGallery";
import {
  categoryLabel,
  isFree,
  platformsLabel,
  priceLabel,
  secondaryPriceLabel,
} from "@/features/products/format";
import { pick, type Locale } from "@/i18n/shared";
import type { Product } from "@/types/product";

interface ProductHeroProps {
  readonly product: Product;
  readonly locale: Locale;
  /** Solo para gratuitos: `false` mientras no haya instalador cargado. */
  readonly downloadAvailable?: boolean;
}

/**
 * Encabezado de la ficha: la sección más fuerte de la página.
 *
 * A la izquierda la imagen del programa cuando existe; a la derecha el bloque
 * comercial completo. Si todavía no hay capturas, la columna de imagen no se dibuja
 * y el texto ocupa el ancho: nunca se rellena con un mockup inventado.
 */
export function ProductHero({
  product,
  locale,
  downloadAvailable = false,
}: ProductHeroProps) {
  const gratuito = isFree(product);
  const segundoPrecio = secondaryPriceLabel(product, locale);
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
        <ProductGallery images={imagenes} productName={product.name} locale={locale} />
      ) : null}

      <div>
        <p className="eyebrow text-accent-contrast">
          {categoryLabel(product.category, locale)}
        </p>

        <h1 className="display mt-4 text-5xl sm:text-6xl">{product.name}</h1>

        <p className="mt-5 text-lg leading-relaxed text-muted">
          {product.shortDescription}
        </p>

        <p className="eyebrow mt-6">
          {platformsLabel(product.platforms)}
          <span className="px-2 text-border">·</span>
          {pick(locale, "versión", "version", "versão")} {product.version}
        </p>

        <div className="mt-9 border-t border-border pt-7">
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <p className="display text-5xl">{priceLabel(product, locale)}</p>
            {segundoPrecio !== null ? (
              <p className="pb-1 text-sm text-muted">{segundoPrecio}</p>
            ) : null}
          </div>

          <ul className="mt-5 flex flex-wrap gap-2">
            {[
              gratuito
                ? pick(locale, "Descarga gratuita", "Free download", "Download gratuito")
                : pick(locale, "Pago único", "One-time payment", "Pagamento único"),
              pick(locale, "Sin suscripción", "No subscription", "Sem assinatura"),
            ].map((sello) => (
              <li
                key={sello}
                className="eyebrow border border-accent/40 px-3 py-1.5 text-accent-contrast"
              >
                {sello}
              </li>
            ))}
            <li className="eyebrow border border-border px-3 py-1.5">
              {pick(locale, "Licencia permanente para esta versión", "Permanent license for this version", "Licença permanente para esta versão")}
            </li>
          </ul>

          <div className="mt-7">
            {gratuito ? (
              product.licenseRequired ? (
                <FreeLicenseButton slug={product.slug} locale={locale} />
              ) : (
                <FreeDownloadButton
                  slug={product.slug}
                  available={downloadAvailable}
                  locale={locale}
                />
              )
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
                <Link
                  href={`/comprar/${encodeURIComponent(product.slug)}`}
                  className="inline-flex min-h-12 items-center justify-center gap-2.5 bg-accent px-8 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast"
                >
                  {pick(locale, "Comprar", "Buy now", "Comprar")}
                </Link>
                <AddToCartButton product={product} locale={locale} secondary className="w-full sm:w-auto" />
              </div>
            )}

            <p className="mt-4 max-w-md text-xs leading-relaxed text-muted">
              {gratuito
                ? product.licenseRequired
                  ? pick(locale, "Es gratis: entrás con tu cuenta y recibís tu licencia para la versión indicada, sin pagar.", "It is free: sign in and get your license for the version shown, with no payment.", "É grátis: entre com sua conta e receba sua licença para a versão indicada, sem pagar.")
                  : pick(locale, "La descarga corresponde a la versión indicada en esta página. No hace falta crear una cuenta ni pagar.", "The download applies to the version shown on this page. No account or payment is required.", "O download corresponde à versão indicada nesta página. Não é preciso criar conta nem pagar.")
                : pick(locale, "La compra corresponde a la versión indicada en esta página. Pagás con Prex, Ualá, transferencia/QR o WhatsApp.", "Your purchase applies to the version shown on this page. Pay with Prex, Ualá, bank transfer/QR or WhatsApp.", "A compra corresponde à versão indicada nesta página. Pague com Prex, Ualá, transferência/QR ou WhatsApp.")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
