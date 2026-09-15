import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/config/site";

/*
  Los legales todavía no tienen página. Se muestran como texto, no como enlace:
  un enlace que lleva a un 404 es peor que una lista que anuncia lo que viene.
*/
const LEGALES = ["Términos", "Privacidad", "Licencia de software"] as const;

export function Footer() {
  const anio = new Date().getFullYear();

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
              Programas de escritorio con pago único. Comprás la versión disponible y
              la usás de forma permanente.
            </p>
          </div>

          <nav aria-labelledby="footer-navegacion">
            <h2 id="footer-navegacion" className="eyebrow">
              Navegación
            </h2>
            <ul className="mt-5 space-y-3">
              {siteConfig.navigation.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-sm text-muted transition-colors hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="eyebrow">Legales</h2>
            <ul className="mt-5 space-y-3">
              {LEGALES.map((legal) => (
                <li key={legal} className="text-sm text-muted/70">
                  {legal}
                  <span className="sr-only"> — disponible próximamente</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="eyebrow">© {anio} Prota Code</p>
          <p className="eyebrow">Pago único · Sin suscripciones</p>
        </div>
      </div>
    </footer>
  );
}
