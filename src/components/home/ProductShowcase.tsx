import Image from "next/image";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { ArrowIcon } from "@/components/ui/Icons";
import {
  platformsLabel,
  primaryPrice,
  secondaryPrice,
} from "@/features/products/format";
import { getPublishedProducts } from "@/features/products/queries";

/**
 * Catálogo destacado.
 *
 * No usa tarjetas. Cada programa es una fila de un índice, separada por una regla
 * fina: lee como el sumario de un manual técnico y funciona bien con dos o tres
 * productos, que es la situación real. Una grilla de tarjetas con dos elementos
 * siempre se ve a medio llenar.
 *
 * Los productos salen de la capa de datos, nunca escritos acá adentro.
 */
export async function ProductShowcase() {
  const productos = await getPublishedProducts();

  return (
    <section
      id="programas"
      aria-labelledby="programas-titulo"
      className="scroll-mt-20 border-t border-border"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionHeading
          index="01"
          label="Programas"
          id="programas-titulo"
          title="Herramientas para problemas concretos."
        >
          Cada programa resuelve una cosa y la resuelve bien. Se compra una vez y se
          usa la versión adquirida.
        </SectionHeading>

        <ul className="mt-14 border-t border-border">
          {productos.map((producto, indice) => (
            <li key={producto.id} className="border-b border-border">
              <Link
                href={`/programas/${producto.slug}`}
                className="group grid gap-6 py-8 transition-colors hover:bg-surface/60 md:grid-cols-[3.5rem_1fr_auto] md:items-start md:gap-8 md:px-4"
              >
                <span className="eyebrow pt-1 text-accent-contrast md:text-base">
                  {String(indice + 1).padStart(2, "0")}
                </span>

                <div className="md:flex md:items-start md:gap-6">
                  {producto.heroImage !== null ? (
                    <Image
                      src={producto.heroImage.src}
                      alt={producto.heroImage.alt}
                      width={160}
                      height={160}
                      sizes="160px"
                      loading="lazy"
                      className="mb-4 h-28 w-28 shrink-0 border border-border object-cover md:mb-0"
                    />
                  ) : null}

                  <div>
                    <h3 className="text-2xl font-semibold tracking-tight transition-colors group-hover:text-accent-contrast sm:text-3xl">
                      {producto.name}
                    </h3>
                    <p className="mt-3 max-w-xl text-base leading-relaxed text-muted">
                      {producto.shortDescription}
                    </p>
                    <p className="eyebrow mt-4">
                      {platformsLabel(producto.platforms)}
                      <span className="px-2 text-border">·</span>
                      versión {producto.version}
                    </p>
                  </div>
                </div>

                <div className="md:pt-1 md:text-right">
                  <p className="text-2xl font-semibold tracking-tight">
                    {primaryPrice(producto)}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {secondaryPrice(producto)}
                  </p>
                  <p className="mt-3">
                    <span className="eyebrow border border-accent/40 px-2 py-1 text-accent-contrast">
                      Pago único
                    </span>
                  </p>
                  <p className="mt-4 flex items-center gap-2 text-sm font-medium text-foreground md:justify-end">
                    Conocer el programa
                    <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
