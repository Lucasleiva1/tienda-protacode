import Link from "next/link";
import { pick, type Locale } from "@/i18n/shared";
import { ArrowIcon } from "@/components/ui/Icons";

/**
 * Carrito vacío.
 *
 * No es una pantalla en blanco ni una ilustración genérica: mantiene el mismo
 * recurso visual del resto del sitio, el filo de color y la tipografía condensada,
 * y ofrece la única salida que tiene sentido.
 */
export function EmptyCart({ locale = "es" }: { readonly locale?: Locale }) {
  return (
    <div className="border border-border bg-surface">
      <div aria-hidden="true" className="h-px bg-accent/70" />

      <div className="px-6 py-20 text-center sm:px-10">
        <p className="eyebrow text-accent-contrast">{pick(locale, "Carrito", "Cart", "Carrinho")}</p>

        <p className="display mx-auto mt-5 max-w-md text-4xl sm:text-5xl">
          {pick(locale, "Tu carrito está vacío.", "Your cart is empty.", "Seu carrinho está vazio.")}
        </p>

        <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-muted">
          {pick(locale, "Encontrá una herramienta para resolver lo que necesitás. Se paga una vez y queda tuya.", "Find a tool for what you need. Pay once and keep it.", "Encontre uma ferramenta para o que você precisa. Você paga uma vez e ela fica sua.")}
        </p>

        <Link
          href="/programas"
          className="group mt-9 inline-flex items-center gap-2.5 bg-accent px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast"
        >
          {pick(locale, "Ver programas", "View programs", "Ver programas")}
          <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
        </Link>
      </div>
    </div>
  );
}
