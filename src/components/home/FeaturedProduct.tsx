import Image from "next/image";
import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  licenseLabel,
  platformsLabel,
  primaryPrice,
  secondaryPrice,
} from "@/features/products/format";
import { getFeaturedProducts } from "@/features/products/queries";

const DESCARGA_LABELS = {
  installer: "Instalador",
  portable: "Portable",
  archive: "Archivo comprimido",
} as const;

/**
 * Producto destacado.
 *
 * Toma el primer producto con `featured: true`, de forma determinista y sin carrusel.
 * Si todavía no hay ninguno destacado, la sección no se dibuja: es mejor que mostrar
 * un hueco.
 *
 * La columna derecha es una ficha técnica, no una tarjeta decorativa. El día que el
 * producto tenga imagen real, la imagen aparece arriba de la ficha sin tocar nada.
 */
export async function FeaturedProduct() {
  const destacado = (await getFeaturedProducts())[0];

  if (destacado === undefined) {
    return null;
  }

  const ficha = [
    { etiqueta: "Identificador", valor: destacado.appId, mono: true },
    { etiqueta: "Versión", valor: destacado.version, mono: true },
    { etiqueta: "Sistema", valor: platformsLabel(destacado.platforms), mono: false },
    { etiqueta: "Licencia", valor: licenseLabel(destacado.licenseType), mono: false },
    { etiqueta: "Entrega", valor: DESCARGA_LABELS[destacado.downloadType], mono: false },
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
          label="Destacado"
          id="destacado-titulo"
          title={destacado.name}
        />

        <div className="mt-14 grid gap-12 lg:grid-cols-[1.15fr_1fr] lg:gap-20">
          <div>
            <p className="eyebrow">Qué resuelve</p>
            <p className="mt-4 text-xl leading-snug text-foreground sm:text-2xl">
              {destacado.shortDescription}
            </p>

            <p className="mt-8 max-w-xl text-base leading-relaxed text-muted">
              {destacado.description}
            </p>

            <div className="mt-10 flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <p className="eyebrow">Precio</p>
                <p className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
                  {primaryPrice(destacado)}
                </p>
                <p className="mt-1 text-sm text-muted">{secondaryPrice(destacado)}</p>
              </div>

              <p className="eyebrow mb-2 border border-accent/40 px-3 py-1.5 text-accent-contrast">
                Pago único
              </p>
            </div>

            <Link
              href={`/programas/${destacado.slug}`}
              className="group mt-10 inline-flex items-center gap-2 bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/85"
            >
              Conocer {destacado.name}
              <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>

          <div>
            {destacado.heroImage !== null ? (
              <Image
                src={destacado.heroImage.src}
                alt={destacado.heroImage.alt}
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
                Ficha del programa
              </p>
              <dl>
                {ficha.map((fila) => (
                  <div
                    key={fila.etiqueta}
                    className="flex items-baseline justify-between gap-6 border-b border-border px-5 py-4 last:border-0"
                  >
                    <dt className="text-sm text-muted">{fila.etiqueta}</dt>
                    <dd
                      className={
                        fila.mono
                          ? "text-right font-display text-sm tracking-wide text-foreground"
                          : "text-right text-sm text-foreground"
                      }
                    >
                      {fila.valor}
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
