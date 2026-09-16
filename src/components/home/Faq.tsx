import { PlusIcon } from "@/components/ui/Icons";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

const QUESTIONS = {
  es: [
    {
      question: "¿Tengo que pagar todos los meses?",
      answer: "No. Los programas de Prota Code se venden mediante pago único.",
    },
    {
      question: "¿La licencia vence?",
      answer: "La licencia de uso de la versión adquirida es permanente, salvo que las condiciones específicas del producto indiquen lo contrario.",
    },
    {
      question: "¿Incluye futuras actualizaciones?",
      answer: "No. Comprás la versión del programa disponible al momento de la compra.",
    },
    {
      question: "¿Cómo recibo el programa?",
      answer: "Después de aprobarse la compra, podrás acceder a la descarga y a la información necesaria para activarlo.",
    },
    {
      question: "¿Necesito internet?",
      answer: "Dependerá de cada aplicación. Los requisitos específicos estarán indicados en la ficha de cada programa.",
    },
  ],
  en: [
    {
      question: "Do I have to pay every month?",
      answer: "No. Prota Code programs are sold with a one-time payment.",
    },
    {
      question: "Does the license expire?",
      answer: "The license for the purchased version is permanent unless the product's specific terms state otherwise.",
    },
    {
      question: "Are future updates included?",
      answer: "No. You purchase the version available at the time of purchase.",
    },
    {
      question: "How do I receive the program?",
      answer: "After your purchase is approved, you can access the download and the information needed to activate it.",
    },
    {
      question: "Do I need internet?",
      answer: "That depends on the application. Its specific requirements are listed on each program's page.",
    },
  ],
  pt: [
    {
      question: "Tenho que pagar todo mês?",
      answer: "Não. Os programas da Prota Code são vendidos com pagamento único.",
    },
    {
      question: "A licença expira?",
      answer: "A licença de uso da versão adquirida é permanente, salvo se as condições específicas do produto indicarem o contrário.",
    },
    {
      question: "Inclui atualizações futuras?",
      answer: "Não. Você compra a versão do programa disponível no momento da compra.",
    },
    {
      question: "Como recebo o programa?",
      answer: "Depois que a compra for aprovada, você poderá acessar o download e as informações necessárias para ativá-lo.",
    },
    {
      question: "Preciso de internet?",
      answer: "Depende de cada aplicativo. Os requisitos específicos estão indicados na ficha de cada programa.",
    },
  ],
} as const;

export async function Faq() {
  const locale = await getLocale();
  return (
    <section
      id="preguntas"
      aria-labelledby="preguntas-titulo"
      className="scroll-mt-20 border-t border-border"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <SectionHeading
            index="05"
            label={pick(locale, "Preguntas", "Questions", "Perguntas")}
            id="preguntas-titulo"
            title={pick(
              locale,
              "Lo que conviene saber antes de comprar.",
              "What to know before you buy.", "O que saber antes de comprar.",
            )}
          />
          <div className="border-t border-border">
            {QUESTIONS[locale].map((item) => (
              <details key={item.question} className="group border-b border-border">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-base font-medium text-foreground transition-colors hover:text-accent-contrast [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <PlusIcon className="h-4 w-4 shrink-0 text-muted transition-transform duration-300 group-open:rotate-45" />
                </summary>
                <p className="max-w-2xl pb-6 pr-10 text-sm leading-relaxed text-muted">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
