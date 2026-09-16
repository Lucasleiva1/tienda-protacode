import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Icons";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

export async function FinalCta() {
  const locale = await getLocale();
  return (
    <section aria-labelledby="cierre" className="relative border-t border-border">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
      />
      <div className="mx-auto w-full max-w-[1400px] px-4 py-24 sm:px-6 lg:px-10 lg:py-36">
        <div className="max-w-3xl">
          <h2 id="cierre" className="display text-4xl sm:text-6xl lg:text-7xl">
            {pick(
              locale,
              "Encontrá la herramienta que te ahorra trabajo.",
              "Find the tool that saves you time.", "Encontre a ferramenta que poupa seu trabalho.",
            )}
          </h2>
          <p className="mt-8 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            {pick(
              locale,
              "Programas chicos, concretos y de pago único. Los comprás una vez y los usás.",
              "Small, focused programs with a one-time payment. Buy them once and use them.", "Programas pequenos, objetivos e com pagamento único. Você compra uma vez e usa.",
            )}
          </p>
          <Link
            href="/programas"
            className="group mt-10 inline-flex items-center gap-3 bg-accent px-8 py-4 text-sm font-medium uppercase tracking-[0.12em] text-accent-foreground transition-colors hover:bg-accent/85"
          >
            {pick(locale, "Ver programas", "View programs", "Ver programas")}
            <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
}
