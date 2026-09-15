import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Icons";

/**
 * Carrito vacío.
 *
 * No es una pantalla en blanco ni una ilustración genérica: mantiene el mismo
 * recurso visual del resto del sitio, el filo de color y la tipografía condensada,
 * y ofrece la única salida que tiene sentido.
 */
export function EmptyCart() {
  return (
    <div className="border border-border bg-surface">
      <div aria-hidden="true" className="h-px bg-accent/70" />

      <div className="px-6 py-20 text-center sm:px-10">
        <p className="eyebrow text-accent-contrast">Carrito</p>

        <p className="display mx-auto mt-5 max-w-md text-4xl sm:text-5xl">
          Tu carrito está vacío.
        </p>

        <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-muted">
          Encontrá una herramienta para resolver lo que necesitás. Se paga una vez y
          queda tuya.
        </p>

        <Link
          href="/programas"
          className="group mt-9 inline-flex items-center gap-2.5 bg-accent px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast"
        >
          Ver programas
          <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
