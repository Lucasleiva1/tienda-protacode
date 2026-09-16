import { formatMoney } from "@/lib/utils/money";
import { localizeProduct } from "@/i18n/product-copy";
import { numberLocale, pick, type Locale } from "@/i18n/shared";
import type { Money, Product } from "@/types/product";

interface CheckoutSummaryProps {
  readonly products: readonly Product[];
  readonly locale: Locale;
  readonly subtotal: Money;
}

/**
 * Resumen final antes de crear el pedido.
 *
 * Los importes que se ven acá son informativos: el precio que vale es el que
 * recalcula el servidor al crear el pedido. Ver `order-service.ts`.
 *
 * No hay impuestos, envío ni cuotas porque no están definidos y son productos
 * digitales. Total = subtotal, sin renglones inventados.
 */
export function CheckoutSummary({ products, subtotal, locale }: CheckoutSummaryProps) {
  const importe = formatMoney(subtotal, numberLocale(locale));

  return (
    <aside
      aria-labelledby="resumen-checkout"
      className="border border-border bg-surface lg:sticky lg:top-24"
    >
      <div aria-hidden="true" className="h-px bg-accent/70" />

      <div className="p-6 sm:p-7">
        <h2 id="resumen-checkout" className="eyebrow text-accent-contrast">
          {pick(locale, "Tu compra", "Your purchase", "Sua compra")}
        </h2>

        <ul className="mt-6 border-t border-border">
          {products.map((producto) => (
            <li
              key={producto.slug}
              className="flex items-baseline justify-between gap-4 border-b border-border py-4"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">{localizeProduct(producto, locale).name}</p>
                <p className="eyebrow mt-1">{pick(locale, "versión", "version", "versão")} {producto.version}</p>
              </div>
              <p className="shrink-0 text-sm">
                {formatMoney(producto.price[subtotal.currency], numberLocale(locale))}
              </p>
            </li>
          ))}
        </ul>

        <dl className="mt-6 space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted">Subtotal</dt>
            <dd className="text-sm text-foreground">{importe}</dd>
          </div>

          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
            <dt className="display text-xl">Total</dt>
            <dd className="display text-3xl">{importe}</dd>
          </div>
        </dl>

        <ul className="mt-5 flex flex-wrap gap-2">
          {[pick(locale, "Pago único", "One-time payment", "Pagamento único"), pick(locale, "Sin suscripción", "No subscription", "Sem assinatura")].map((sello) => (
            <li
              key={sello}
              className="eyebrow border border-accent/40 px-3 py-1.5 text-accent-contrast"
            >
              {sello}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
