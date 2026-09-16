import Link from "next/link";
import { pick, type Locale } from "@/i18n/shared";

interface Paso {
  readonly label: string;
  /** Sin `href` es el paso actual: se muestra como texto, no como enlace. */
  readonly href?: string;
}

interface BreadcrumbProps {
  readonly items: readonly Paso[];
  readonly locale?: Locale;
}

/** Navegación contextual. Discreta a propósito: ubica, no decora. */
export function Breadcrumb({ items, locale = "es" }: BreadcrumbProps) {
  return (
    <nav aria-label={pick(locale, "Ruta de navegación", "Breadcrumb", "Trilha de navegação")}>
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((paso, indice) => {
          const ultimo = indice === items.length - 1;
          return (
            <li key={paso.label} className="flex items-center gap-1.5">
              {paso.href !== undefined && !ultimo ? (
                <Link
                  href={paso.href}
                  className="eyebrow transition-colors hover:text-foreground"
                >
                  {paso.label}
                </Link>
              ) : (
                <span className="eyebrow text-foreground" aria-current="page">
                  {paso.label}
                </span>
              )}
              {!ultimo ? (
                <span aria-hidden="true" className="eyebrow text-border">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
