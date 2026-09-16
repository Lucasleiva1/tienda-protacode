import { SectionHeading } from "@/components/ui/SectionHeading";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

const STEPS = {
  es: [
    { number: "01", title: "Elegí", detail: "Mirá qué resuelve cada programa." },
    { number: "02", title: "Pagá una vez", detail: "Un solo pago, sin renovación." },
    { number: "03", title: "Descargá", detail: "El archivo queda disponible." },
    { number: "04", title: "Activá", detail: "Con la licencia de tu compra." },
    { number: "05", title: "Usalo", detail: "La versión comprada es tuya." },
  ],
  en: [
    { number: "01", title: "Choose", detail: "See what each program solves." },
    { number: "02", title: "Pay once", detail: "One payment, no renewal." },
    { number: "03", title: "Download", detail: "Get access to your file." },
    { number: "04", title: "Activate", detail: "Use your purchase license." },
    { number: "05", title: "Use it", detail: "The purchased version is yours." },
  ],
  pt: [
    { number: "01", title: "Escolha", detail: "Veja o que cada programa resolve." },
    { number: "02", title: "Pague uma vez", detail: "Um único pagamento, sem renovação." },
    { number: "03", title: "Baixe", detail: "O arquivo fica disponível." },
    { number: "04", title: "Ative", detail: "Com a licença da sua compra." },
    { number: "05", title: "Use", detail: "A versão comprada é sua." },
  ],
} as const;

export async function HowItWorks() {
  const locale = await getLocale();
  return (
    <section
      id="como-funciona"
      aria-labelledby="como-funciona-titulo"
      className="scroll-mt-20 border-t border-border bg-surface"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionHeading
          index="04"
          label={pick(locale, "Cómo funciona", "How it works", "Como funciona")}
          id="como-funciona-titulo"
          title={pick(locale, "De la compra al programa abierto.", "From purchase to running program.", "Da compra ao programa aberto.")}
        />
        <ol className="mt-14 grid gap-0 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS[locale].map((step) => (
            <li
              key={step.number}
              className="border-l border-border py-6 pl-6 lg:border-l-0 lg:border-t lg:py-0 lg:pb-0 lg:pl-0 lg:pr-6 lg:pt-6"
            >
              <span aria-hidden="true" className="mb-4 block h-1.5 w-1.5 bg-accent lg:mb-6" />
              <p className="font-display text-4xl font-semibold text-muted lg:text-5xl">
                {step.number}
              </p>
              <h3 className="mt-3 text-lg font-semibold uppercase tracking-wide">
                {step.title}
              </h3>
              <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-muted">
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-12 border-t border-border pt-6 text-sm text-muted">
          {pick(locale, "Sin cuotas mensuales.", "No monthly payments.", "Sem mensalidades.")}
        </p>
      </div>
    </section>
  );
}
