import { SectionHeading } from "@/components/ui/SectionHeading";

const PASOS = [
  { numero: "01", titulo: "Elegí", detalle: "Mirá qué resuelve cada programa." },
  { numero: "02", titulo: "Pagá una vez", detalle: "Un solo pago, sin renovación." },
  { numero: "03", titulo: "Descargá", detalle: "El archivo queda disponible." },
  { numero: "04", titulo: "Activá", detalle: "Con la licencia de tu compra." },
  { numero: "05", titulo: "Usalo", detalle: "La versión comprada es tuya." },
] as const;

/**
 * Cómo funciona.
 *
 * Cinco pasos sin cinco tarjetas iguales: la numeración grande manda y la regla
 * superior es continua porque cada paso aporta su propio tramo de borde. En mobile
 * esa misma regla gira y baja por la izquierda, que es como se lee una secuencia en
 * una pantalla angosta.
 */
export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-titulo"
      className="scroll-mt-20 border-t border-border bg-surface"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionHeading
          index="04"
          label="Cómo funciona"
          id="como-funciona-titulo"
          title="De la compra al programa abierto."
        />

        <ol className="mt-14 grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
          {PASOS.map((paso) => (
            <li
              key={paso.numero}
              className="border-l border-border py-6 pl-6 lg:border-l-0 lg:border-t lg:py-0 lg:pb-0 lg:pl-0 lg:pr-6 lg:pt-6"
            >
              <span
                aria-hidden="true"
                className="mb-4 block h-1.5 w-1.5 bg-accent lg:mb-6"
              />
              <p className="font-display text-4xl font-semibold text-muted lg:text-5xl">
                {paso.numero}
              </p>
              <h3 className="mt-3 text-lg font-semibold uppercase tracking-wide">
                {paso.titulo}
              </h3>
              <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-muted">
                {paso.detalle}
              </p>
            </li>
          ))}
        </ol>

        <p className="mt-12 border-t border-border pt-6 text-sm text-muted">
          Sin cuotas mensuales.
        </p>
      </div>
    </section>
  );
}
