import type { ComponentPropsWithoutRef } from "react";

type SectionProps = ComponentPropsWithoutRef<"section">;

/**
 * Bloque vertical con separación consistente.
 *
 * Renderiza un `<section>` real y deja pasar el resto de los atributos, para poder
 * etiquetarlo con `aria-labelledby` sin envolverlo en otro componente.
 */
export function Section({ className = "", children, ...props }: SectionProps) {
  return (
    <section className={`py-10 sm:py-14 ${className}`} {...props}>
      {children}
    </section>
  );
}
