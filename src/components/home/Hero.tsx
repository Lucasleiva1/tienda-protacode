import Image from "next/image";
import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Icons";
import { siteConfig } from "@/config/site";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

/** The cover image and its copy stay in one section at every viewport width. */
export async function Hero() {
  const locale = await getLocale();
  return (
    <section
      aria-labelledby="portada"
      className="relative isolate flex min-h-[720px] overflow-hidden bg-background sm:min-h-[640px] lg:min-h-[560px] xl:min-h-[min(88vh,56.28vw)]"
    >
      <Image
        src={siteConfig.cover.src}
        alt={pick(
          locale,
          siteConfig.cover.alt,
          "Prota Code software box on an illuminated platform surrounded by app screens.", "Caixa do software Prota Code sobre uma plataforma iluminada, cercada por telas de aplicativos.",
        )}
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[85%_top] sm:object-[70%_center] lg:object-[62%_65%] xl:object-[58%_55%]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-transparent from-[25%] via-background/80 via-[55%] to-background/95 lg:bg-gradient-to-r lg:from-background/90 lg:via-background/50 lg:to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
      />
      <div className="relative z-10 mx-auto flex min-w-0 w-full max-w-[1400px] flex-col justify-end px-4 pb-10 pt-[300px] sm:px-6 sm:pb-12 sm:pt-[260px] lg:justify-center lg:px-10 lg:py-16">
        <div className="min-w-0 max-w-xl lg:max-w-sm xl:max-w-md">
          <p className="eyebrow">
            {pick(locale, "Programas de escritorio · Pago único", "Desktop programs · One-time payment", "Programas para computador · Pagamento único")}
          </p>
          <h1
            id="portada"
            className="display mt-4 text-[2.15rem] sm:mt-5 sm:text-5xl lg:text-[2.65rem] xl:text-5xl 2xl:text-6xl"
          >
            {pick(locale, "Herramientas que se compran una vez.", "Tools you buy once.", "Ferramentas que você compra uma vez.")}
          </h1>
          <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:mt-6 sm:text-lg">
            {pick(
              locale,
              "Pagás, descargás y las usás. La versión que comprás queda tuya de forma permanente, sin cuotas todos los meses.",
              "Pay, download, and use them. The version you buy is yours to use permanently, with no monthly payments.", "Você paga, baixa e usa. A versão que você compra fica sua de forma permanente, sem mensalidades.",
            )}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
            <Link
              href="/programas"
              className="group inline-flex items-center gap-2 bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/85"
            >
              {pick(locale, "Ver programas", "View programs", "Ver programas")}
              <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <Link
              href="#como-funciona"
              className="inline-flex items-center gap-2 border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-accent-contrast/60 hover:bg-surface"
            >
              {pick(locale, "Cómo funciona", "How it works", "Como funciona")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
