import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

const CONCEPTS = {
  es: [
    { title: "Pago único", detail: "Un solo pago. No hay renovación ni vencimiento de cobro." },
    { title: "Sin suscripción", detail: "No hay cuota mensual ni anual. No se guarda una tarjeta." },
    { title: "Licencia permanente", detail: "Licencia de uso permanente para la versión adquirida." },
  ],
  en: [
    { title: "One-time payment", detail: "One payment. No renewal or recurring charge." },
    { title: "No subscription", detail: "No monthly or annual fee. No card stored." },
    { title: "Permanent license", detail: "A permanent-use license for the version purchased." },
  ],
  pt: [
    { title: "Pagamento único", detail: "Um único pagamento. Sem renovação nem cobrança recorrente." },
    { title: "Sem assinatura", detail: "Sem mensalidade nem anuidade. Nenhum cartão fica salvo." },
    { title: "Licença permanente", detail: "Licença de uso permanente para a versão adquirida." },
  ],
} as const;

export async function SoftwareWithoutRent() {
  const locale = await getLocale();
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
              {pick(locale, "Filosofía", "Philosophy", "Filosofia")}
            </p>
            <h2
              id="sin-alquiler-titulo"
              className="display mt-8 text-5xl sm:text-7xl lg:text-[5.5rem]"
            >
              <span className="block">Software</span>
              <span className="block text-accent-contrast">
                {pick(locale, "sin", "you", "sem")}
              </span>
              <span className="block">
                {pick(locale, "alquiler.", "own.", "aluguel.")}
              </span>
            </h2>
          </div>
          <div className="lg:pt-24">
            <p className="max-w-lg text-lg leading-relaxed text-foreground sm:text-xl">
              {pick(
                locale,
                "Hay herramientas que no necesitan una cuota todos los meses.",
                "Some tools do not need a monthly bill.", "Há ferramentas que não precisam de uma mensalidade.",
              )}
            </p>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted">
              {pick(
                locale,
                "Prota Code hace aplicaciones chicas para problemas concretos. Se compran una vez, se descargan y se usan. No hay suscripción, no hay renovación y no hace falta volver a pagar para seguir abriendo el programa.",
                "Prota Code makes focused applications for specific problems. Buy them once, download, and use them. There is no subscription or renewal, and you do not have to pay again to keep using the program.", "A Prota Code faz aplicativos pequenos para problemas concretos. Você compra uma vez, baixa e usa. Não há assinatura nem renovação, e não é preciso pagar de novo para continuar abrindo o programa.",
              )}
            </p>
            <dl className="mt-12 border-t border-border">
              {CONCEPTS[locale].map((concept) => (
                <div
                  key={concept.title}
                  className="border-b border-border py-5 sm:flex sm:items-baseline sm:gap-8"
                >
                  <dt className="eyebrow shrink-0 text-foreground sm:w-52">
                    {concept.title}
                  </dt>
                  <dd className="mt-2 text-sm leading-relaxed text-muted sm:mt-0">
                    {concept.detail}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-8 max-w-lg text-sm leading-relaxed text-muted">
              {pick(
                locale,
                "No se prometen actualizaciones futuras: lo que comprás es la versión del programa disponible en ese momento.",
                "Future updates are not promised: you purchase the version available at that time.", "Não prometemos atualizações futuras: você compra a versão do programa disponível naquele momento.",
              )}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
