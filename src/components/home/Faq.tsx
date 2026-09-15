import { PlusIcon } from "@/components/ui/Icons";
import { SectionHeading } from "@/components/ui/SectionHeading";

const PREGUNTAS = [
  {
    pregunta: "¿Tengo que pagar todos los meses?",
    respuesta:
      "No. Los programas de Prota Code se venden mediante pago único.",
  },
  {
    pregunta: "¿La licencia vence?",
    respuesta:
      "La licencia de uso de la versión adquirida es permanente, salvo que las condiciones específicas del producto indiquen lo contrario.",
  },
  {
    pregunta: "¿Incluye futuras actualizaciones?",
    respuesta:
      "No. Comprás la versión del programa disponible al momento de la compra.",
  },
  {
    pregunta: "¿Cómo recibo el programa?",
    respuesta:
      "Después de aprobarse la compra, podrás acceder a la descarga y a la información necesaria para activarlo.",
  },
  {
    pregunta: "¿Necesito internet?",
    respuesta:
      "Dependerá de cada aplicación. Los requisitos específicos estarán indicados en la ficha de cada programa.",
  },
] as const;

/**
 * Preguntas frecuentes.
 *
 * Acordeón con `<details>` y `<summary>` nativos: el navegador ya resuelve el
 * teclado, el foco y el anuncio de abierto/cerrado. Cualquier librería de acordeón
 * sería peso de más para replicar lo que el HTML hace solo.
 */
export function Faq() {
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
            label="Preguntas"
            id="preguntas-titulo"
            title="Lo que conviene saber antes de comprar."
          />

          <div className="border-t border-border">
            {PREGUNTAS.map((item) => (
              <details
                key={item.pregunta}
                className="group border-b border-border"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-base font-medium text-foreground transition-colors hover:text-accent-contrast [&::-webkit-details-marker]:hidden">
                  {item.pregunta}
                  <PlusIcon className="h-4 w-4 shrink-0 text-muted transition-transform duration-300 group-open:rotate-45" />
                </summary>
                <p className="max-w-2xl pb-6 pr-10 text-sm leading-relaxed text-muted">
                  {item.respuesta}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
