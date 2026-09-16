import Image from "next/image";
import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  downloadLabel,
  isFree,
  licenseLabel,
  platformsLabel,
  priceLabel,
  secondaryPriceLabel,
} from "@/features/products/format";
import { getFeaturedProducts } from "@/features/products/queries";
import { localizeProduct } from "@/i18n/product-copy";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

export async function FeaturedProduct() {
  const [featured, locale] = await Promise.all([getFeaturedProducts(), getLocale()]);
  const original = featured[0];
  if (original === undefined) return null;
  const product = localizeProduct(original, locale);

  const facts = [
    { label: pick(locale, "Identificador", "Identifier", "Identificador"), value: product.appId, mono: true },
    { label: pick(locale, "Versión", "Version", "Versão"), value: product.version, mono: true },
    { label: pick(locale, "Sistema", "System", "Sistema"), value: platformsLabel(product.platforms), mono: false },
    { label: pick(locale, "Licencia", "License", "Licença"), value: licenseLabel(product.licenseType, locale), mono: false },
    { label: pick(locale, "Entrega", "Delivery", "Entrega"), value: downloadLabel(product.downloadType, locale), mono: false },
  ];

  return (
    <section
      id="destacado"
      aria-labelledby="destacado-titulo"
      className="scroll-mt-20 border-t border-border"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionHeading
          index="03"
          label={pick(locale, "Destacado", "Featured", "Destaque")}
          id="destacado-titulo"
          title={product.name}
        />
        <div className="mt-14 grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
          <div>
            <p className="eyebrow">{pick(locale, "Qué resuelve", "What it solves", "O que resolve")}</p>
            <p className="mt-4 text-xl leading-snug text-foreground sm:text-2xl">
              {product.shortDescription}
            </p>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-muted">
              {product.description}
            </p>
            <div className="mt-10 flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <p className="eyebrow">{pick(locale, "Precio", "Price", "Preço")}</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
                  {priceLabel(product, locale)}
                </p>
                {secondaryPriceLabel(product, locale) !== null ? (
                  <p className="mt-1 text-sm text-muted">
                    {secondaryPriceLabel(product, locale)}
                  </p>
                ) : null}
              </div>
              <p className="eyebrow mb-2 border border-accent/40 px-3 py-1.5 text-accent-contrast">
                {isFree(product)
                  ? pick(locale, "Descarga gratuita", "Free download", "Download gratuito")
                  : pick(locale, "Pago único", "One-time payment", "Pagamento único")}
              </p>
            </div>
            <Link
              href={"/programas/" + product.slug}
              className="group mt-10 inline-flex items-center gap-2 bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/85"
            >
              {pick(locale, "Conocer ", "Explore ", "Conhecer ")}{product.name}
              <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
          <div>
            {product.heroImage !== null ? (
              <Image
                src={product.heroImage.src}
                alt={product.heroImage.alt}
                width={900}
                height={600}
                sizes="(min-width: 1024px) 44vw, 100vw"
                loading="lazy"
                className="mb-8 w-full border border-border object-cover"
              />
            ) : null}
            <div className="border border-border">
              <div aria-hidden="true" className="h-px bg-accent/60" />
              <p className="eyebrow border-b border-border px-5 py-4">
                {pick(locale, "Ficha del programa", "Program details", "Ficha do programa")}
              </p>
              <dl>
                {facts.map((fact) => (
                  <div
                    key={fact.label}
                    className="flex items-baseline justify-between gap-6 border-b border-border px-5 py-4 last:border-0"
                  >
                    <dt className="text-sm text-muted">{fact.label}</dt>
                    <dd
                      className={
                        fact.mono
                          ? "text-right font-display text-sm tracking-wide text-foreground"
                          : "text-right text-sm text-foreground"
                      }
                    >
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
