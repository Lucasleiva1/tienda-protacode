import Link from "next/link";
import { formatMoney } from "@/lib/utils/money";
import type { Money } from "@/types/product";

interface CartSummaryProps {
  readonly count: number;
  readonly subtotal: Money;
  readonly whatsappRequested: boolean;
  readonly whatsappEnabled: boolean;
}

/**
 * Resumen de la compra.
 *
 * Productos digitales: no hay envío, ni impuestos, ni comisiones que declarar acá.
 * Por eso el total es igual al subtotal y no se inventan renglones intermedios.
 *
 * El botón lleva al checkout, donde se piden los datos y se prepara el pedido. No
 * cobra: todavía no hay proveedor de pagos elegido.
 */
export function CartSummary({
  count,
  subtotal,
  whatsappRequested,
  whatsappEnabled,
}: CartSummaryProps) {
  const importe = formatMoney(subtotal);

  return (
    <aside
      aria-labelledby="resumen"
      className="border border-border bg-surface lg:sticky lg:top-24"
    >
      <div aria-hidden="true" className="h-px bg-accent/70" />

      <div className="p-6 sm:p-7">
        <h2 id="resumen" className="eyebrow text-accent-contrast">
          Resumen
        </h2>

        <dl className="mt-6 space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted">Programas</dt>
            <dd className="text-sm text-foreground">{count}</dd>
          </div>

          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted">Subtotal</dt>
            <dd className="text-sm text-foreground">{importe}</dd>
          </div>

          <div className="flex items-baseline justify-between gap-4 border-t border-border pt-4">
            <dt className="display text-xl">Total</dt>
            <dd className="display text-3xl">{importe}</dd>
          </div>
        </dl>

        <p className="eyebrow mt-5 inline-block border border-accent/40 px-3 py-1.5 text-accent-contrast">
          Pago único
        </p>

        <Link
          href="/checkout"
          className="mt-7 block w-full bg-accent px-6 py-3.5 text-center text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast"
        >
          Continuar con la compra
        </Link>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          {whatsappRequested
            ? whatsappEnabled
              ? "En el siguiente paso completás tus datos y continuás la compra por WhatsApp. Todavía no se te cobra nada."
              : "La compra por WhatsApp estará disponible cuando terminemos de configurar el número de atención."
            : "Todavía no se te cobra nada: el medio de pago aún no está configurado."}
        </p>

        <div className="mt-7 border-t border-border pt-5">
          <p className="text-xs leading-relaxed text-muted">
            Cada programa se paga una sola vez. No hay suscripción ni cuota mensual. La
            licencia es de uso permanente para la versión que comprás y no incluye
            futuras versiones salvo que se indique expresamente.
          </p>
        </div>

        <Link
          href="/programas"
          className="mt-6 inline-block text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-accent"
        >
          Seguir viendo programas
        </Link>
      </div>
    </aside>
  );
}
