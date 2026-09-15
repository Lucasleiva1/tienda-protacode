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
  const producto = await getProductBySlug(slug);

  if (producto === undefined) {
    return { title: "Programa no encontrado" };
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
  const producto = await getProductBySlug(slug);

  if (producto === undefined) {
    notFound();
  }

  const relacionados = await getRelatedProducts(slug, 3);

  return (
    <main>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        <Breadcrumb
          items={[
            { label: "Inicio", href: "/" },
            { label: "Programas", href: "/programas" },
            { label: producto.name },
          ]}
        />

        <section aria-label={producto.name} className="mt-10">
          <ProductHero product={producto} />
        </section>

        <section aria-labelledby="que-hace" className="mt-20 border-t border-border pt-14">
          <h2 id="que-hace" className="display text-3xl sm:text-4xl">
            Qué hace
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-relaxed text-muted">
            {producto.description}
          </p>
        </section>

        <div className="mt-20 border-t border-border pt-14">
          <ProductFeatures
            features={producto.features}
            useCases={producto.useCases}
          />
        </div>

        <div className="mt-20 border-t border-border pt-14">
          <ProductRequirements product={producto} />
        </div>

        <div className="mt-20">
          <ProductLicense licenseNote={producto.licenseNote} />
        </div>

        <div className="mt-20 border-t border-border pt-14">
          <RelatedProducts products={relacionados} />
        </div>
      </div>
    </main>
  );
}
