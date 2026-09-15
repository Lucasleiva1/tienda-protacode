const CONCEPTOS = [
  {
    titulo: "Pago único",
    detalle: "Un solo pago. No hay renovación ni vencimiento de cobro.",
  },
  {
    titulo: "Sin suscripción",
    detalle: "No hay cuota mensual ni anual. No se guarda una tarjeta.",
  },
  {
    titulo: "Licencia permanente",
    detalle: "Licencia de uso permanente para la versión adquirida.",
  },
] as const;

/**
 * La sección de identidad de la marca.
 *
 * Rompe el ritmo del resto de la página: fondo distinto y una composición
 * tipográfica grande de tres renglones. Es el único lugar donde el tipo de letra
 * manda por encima de todo, y por eso no lleva ni un ícono.
 */
export function SoftwareWithoutRent() {
  return (
    <section
      id="sin-alquiler"
      aria-labelledby="sin-alquiler-titulo"
      className="scroll-mt-20 border-t border-border bg-surface"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <p className="eyebrow">
              <span className="text-accent-contrast">02</span>
              <span className="px-2 text-border">/</span>
              Filosofía
            </p>

            <h2
              id="sin-alquiler-titulo"
              className="display mt-8 text-5xl sm:text-7xl lg:text-[5.5rem]"
            >
              <span className="block">Software</span>
              <span className="block text-accent-contrast">sin</span>
              <span className="block">alquiler.</span>
            </h2>
          </div>

          <div className="lg:pt-24">
            <p className="max-w-lg text-lg leading-relaxed text-foreground sm:text-xl">
              Hay herramientas que no necesitan una cuota todos los meses.
            </p>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
              Prota Code hace aplicaciones chicas para problemas concretos. Se compran
              una vez, se descargan y se usan. No hay suscripción, no hay renovación y
              no hace falta volver a pagar para seguir abriendo el programa.
            </p>

            <dl className="mt-12 border-t border-border">
              {CONCEPTOS.map((concepto) => (
                <div
                  key={concepto.titulo}
                  className="border-b border-border py-5 sm:flex sm:items-baseline sm:gap-8"
                >
                  <dt className="eyebrow shrink-0 text-foreground sm:w-52">
                    {concepto.titulo}
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted sm:mt-0">
                    {concepto.detalle}
                  </dd>
                </div>
              ))}
            </dl>

            <p className="mt-8 max-w-lg text-sm leading-relaxed text-muted">
              No se prometen actualizaciones futuras: lo que comprás es la versión del
              programa disponible en ese momento.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
