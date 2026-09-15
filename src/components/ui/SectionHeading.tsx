import type { ReactNode } from "react";

interface SectionHeadingProps {
  /** Índice de la sección, en dos dígitos. Es el hilo visual de toda la página. */
  readonly index: string;
  readonly label: string;
  readonly id: string;
  readonly title: ReactNode;
  readonly children?: ReactNode;
}

/**
 * Encabezado de sección.
 *
 * El patrón `[ 03 ] PROGRAMAS` con una regla fina que corre hasta el borde es el
 * recurso que se repite en toda la Home: lee como índice de manual técnico y evita
 * que cada sección arranque con el típico título centrado de landing.
 */
export function SectionHeading({
  index,
  label,
  id,
  title,
  children,
}: SectionHeadingProps) {
  return (
    <header>
      <div className="flex items-center gap-4">
        <span className="eyebrow shrink-0">
          <span className="text-accent-contrast">{index}</span>
          <span className="px-2 text-border">/</span>
          {label}
        </span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>

      <h2
        id={id}
        className="display mt-6 max-w-3xl text-3xl sm:text-4xl lg:text-5xl"
      >
        {title}
      </h2>

      {children !== undefined ? (
        <div className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
          {children}
        </div>
      ) : null}
    </header>
  );
}
