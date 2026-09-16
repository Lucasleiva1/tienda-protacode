import { getLocale } from "@/i18n/server";
import { localizeProduct } from "@/i18n/product-copy";
import { pick } from "@/i18n/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductFeatures } from "@/components/products/ProductFeatures";
import { ProductHero } from "@/components/products/ProductHero";
import { ProductLicense } from "@/components/products/ProductLicense";
import { ProductRequirements } from "@/components/products/ProductRequirements";
import { RelatedProducts } from "@/components/products/RelatedProducts";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import {
  getProductBySlug,
  getRelatedProducts,
} from "@/features/products/queries";
import { getProductDownloadRepository } from "@/features/downloads/product-download-repository";
import { ProductDonation } from "@/components/products/ProductDonation";
import { donationFontClass } from "@/config/donation-fonts-loader";

/*
  Se arma en cada visita.

  Antes se prerenderizaba una página por programa, pero ahora el catálogo lo
  administra el Admin: si se generaran al compilar, un programa nuevo o un precio
  cambiado no aparecerían hasta el siguiente deploy.
*/
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/programas/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const original = await getProductBySlug(slug);
  const producto = original ? localizeProduct(original, locale) : undefined;

  if (producto === undefined) {
    return { title: pick(locale, "Programa no encontrado", "Program not found", "Programa não encontrado") };
  }

  // Solo se declara imagen en Open Graph si existe un archivo real.
  const imagen = producto.heroImage ?? producto.images[0] ?? null;

  return {
    title: producto.name,
    description: producto.shortDescription,
    openGraph: {
      type: "website",
      title: `${producto.name} — Prota Code`,
      description: producto.shortDescription,
      ...(imagen !== null ? { images: [{ url: imagen.src, alt: imagen.alt }] } : {}),
    },
  };
}

/**
 * Ficha de producto.
 *
 * Cada bloque se dibuja únicamente si el producto tiene los datos: un programa sin
 * funciones cargadas no muestra un encabezado "Qué incluye" vacío.
 */
export default async function ProductoPage({
  params,
}: PageProps<"/programas/[slug]">) {
  const { slug } = await params;
  const locale = await getLocale();
  const original = await getProductBySlug(slug);
  const producto = original ? localizeProduct(original, locale) : undefined;

  if (producto === undefined) {
    notFound();
  }

  const relacionados = await getRelatedProducts(slug, 3);

  /*
    Para un gratuito hay que saber si el instalador de ESTA versión ya está cargado:
    sin archivo, el botón se muestra apagado en vez de llevar a un error.
  */
  const descargaLista =
    producto.pricingType === "free" &&
    (await getProductDownloadRepository().find(producto.id, producto.version)) !== null;

  const muestraAportes =
    producto.acceptDonations &&
    (producto.donationAlias !== null || producto.donationQr !== null);

  /*
    El aporte se dibuja dos veces y solo una se ve por vez.

    En escritorio va en una columna propia a la derecha que acompaña el scroll
    (`sticky`): mientras la persona baja leyendo, el alias y el QR siguen a la vista.
    Una sección `sticky` tiene que vivir al lado del contenido que se desplaza, así
    que no puede ser la misma copia que en celular aparece arriba del botón.
  */
  const aporte = (headingId: string, variante: "columna" | "barra") =>
    muestraAportes ? (
      <ProductDonation
        alias={producto.donationAlias}
        qr={producto.donationQr}
        aliasFontClass={donationFontClass(producto.donationAliasFont)}
        variante={variante}
        headingId={headingId}
        locale={locale}
      />
    ) : null;

  return (
    <main>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        <Breadcrumb
          items={[
            { label: pick(locale, "Inicio", "Home", "Início"), href: "/" },
            { label: pick(locale, "Programas", "Programs", "Programas"), href: "/programas" },
            { label: producto.name },
          ]}
        />

        <div className="mt-10 xl:grid xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start xl:gap-10">
        <div className="min-w-0">
        {/*
          En celular el aporte es una cinta fija debajo del encabezado: acompaña
          toda la lectura, no solo el principio de la ficha.
        */}
        {muestraAportes ? (
          <div className="sticky top-16 z-30 mb-6 xl:hidden">
            {aporte("aportes-movil", "barra")}
          </div>
        ) : null}

        <section aria-label={producto.name}>
          <ProductHero
            product={producto}
            locale={locale}
            downloadAvailable={descargaLista}
          />
        </section>

        <section aria-labelledby="que-hace" className="mt-20 border-t border-border pt-14">
          <h2 id="que-hace" className="display text-3xl sm:text-4xl">
            {pick(locale, "Qué hace", "What it does", "O que faz")}
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted">
            {producto.description}
          </p>
        </section>

        <div className="mt-20 border-t border-border pt-14">
          <ProductFeatures
            features={producto.features}
            useCases={producto.useCases}
            locale={locale}
          />
        </div>

        <div className="mt-20 border-t border-border pt-14">
          <ProductRequirements product={producto} locale={locale} />
        </div>

        <div className="mt-20">
          <ProductLicense licenseNote={producto.licenseNote} locale={locale} />
        </div>


        <div className="mt-20 border-t border-border pt-14">
          <RelatedProducts products={relacionados} locale={locale} />
        </div>
        </div>

        {muestraAportes ? (
          <aside className="hidden xl:sticky xl:top-24 xl:block">
            {aporte("aportes", "columna")}
          </aside>
        ) : null}
        </div>
      </div>
    </main>
  );
}
