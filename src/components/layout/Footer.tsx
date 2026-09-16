import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { navigationLabel, pick, type Locale } from "@/i18n/shared";

export function Footer({ locale }: { readonly locale: Locale }) {
  const year = new Date().getFullYear();
  const legal = pick(
    locale,
    ["Términos", "Privacidad", "Licencia de software"],
    ["Terms", "Privacy", "Software license"], ["Termos", "Privacidade", "Licença de software"],
  );

  return (
    <footer className="border-t border-border">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <Image
                src={siteConfig.logo.src}
                alt=""
                width={siteConfig.logo.width}
                height={siteConfig.logo.height}
                sizes="32px"
                className="h-7 w-auto"
              />
              <span className="text-sm font-semibold uppercase tracking-[0.14em]">
                Prota<span className="text-accent-contrast">code</span>
              </span>
            </div>
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
              {pick(
                locale,
                "Programas de escritorio con pago único. Comprás la versión disponible y la usás de forma permanente.",
                "Desktop programs with a one-time payment. Buy the available version and use it permanently.", "Programas para computador com pagamento único. Você compra a versão disponível e a usa de forma permanente.",
              )}
            </p>
          </div>

          <nav aria-labelledby="footer-navegacion">
            <h2 id="footer-navegacion" className="eyebrow">
              {pick(locale, "Navegación", "Navigation", "Navegação")}
            </h2>
            <ul className="mt-5 space-y-3">
              {siteConfig.navigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted transition-colors hover:text-foreground"
                  >
                    {navigationLabel(locale, item.label)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="eyebrow">{pick(locale, "Legales", "Legal", "Legal")}</h2>
            <ul className="mt-5 space-y-3">
              {legal.map((item) => (
                <li key={item} className="text-sm text-muted/70">
                  {item}
                  <span className="sr-only">
                    {pick(locale, " — disponible próximamente", " — coming soon", " — disponível em breve")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="eyebrow">© {year} Prota Code</p>
          <p className="eyebrow">
            {pick(locale, "Pago único · Sin suscripciones", "One-time payment · No subscriptions", "Pagamento único · Sem assinaturas")}
          </p>
        </div>
      </div>
    </footer>
  );
}
