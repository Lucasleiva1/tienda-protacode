import { siteConfig } from "@/config/site";
import type { Money } from "@/types/product";

/** Cuántas unidades mínimas entran en una unidad de la moneda. ARS y USD: 100. */
const MINOR_UNITS = 100;

/**
 * Convierte un importe en centavos a texto listo para mostrar.
 *
 * formatMoney({ amount: 2490000, currency: "ARS" }) → "$ 24.900,00"
 * formatMoney({ amount: 1900, currency: "USD" })    → "US$ 19,00"
 */
export function formatMoney(
  money: Money,
  locale: string = siteConfig.locale,
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: money.currency,
  }).format(money.amount / MINOR_UNITS);
}
