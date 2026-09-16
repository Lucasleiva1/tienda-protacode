import Link from "next/link";
import { formatMoney } from "@/lib/utils/money";
import { numberLocale, pick, type Locale } from "@/i18n/shared";
import type { Money } from "@/types/product";

interface CartSummaryProps {
  readonly count: number;
  readonly locale: Locale;
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
  locale,
  subtotal,
  whatsappRequested,
  whatsappEnabled,
}: CartSummaryProps) {
  const importe = formatMoney(subtotal, numberLocale(locale));

  return (
    <aside
      aria-labelledby="resumen"
      className="border border-border bg-surface lg:sticky lg:top-24"
    >
      <div aria-hidden="true" className="h-px bg-accent/70" />

      <div className="p-6 sm:p-7">
        <h2 id="resumen" className="eyebrow text-accent-contrast">
          {pick(locale, "Resumen", "Summary", "Resumo")}
        </h2>

        <dl className="mt-6 space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted">{pick(locale, "Programas", "Programs", "Programas")}</dt>
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
          {pick(locale, "Pago único", "One-time payment", "Pagamento único")}
        </p>

        <Link
          href="/checkout"
          className="mt-7 block w-full bg-accent px-6 py-3.5 text-center text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast"
        >
          {pick(locale, "Continuar con la compra", "Continue to checkout", "Continuar com a compra")}
        </Link>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          {whatsappRequested
            ? whatsappEnabled
              ? pick(locale, "En el siguiente paso completás tus datos y continuás la compra por WhatsApp. Todavía no se te cobra nada.", "Next, confirm your details and continue via WhatsApp. You will not be charged yet.", "Na próxima etapa você confirma seus dados e continua a compra pelo WhatsApp. Nada será cobrado ainda.")
              : pick(locale, "La compra por WhatsApp estará disponible cuando terminemos de configurar el número de atención.", "WhatsApp purchases will be available once the support number is configured.", "A compra pelo WhatsApp estará disponível quando terminarmos de configurar o número de atendimento.")
            : pick(locale, "Todavía no se te cobra nada: el medio de pago aún no está configurado.", "You will not be charged yet: the payment method is not configured.", "Nada será cobrado ainda: o meio de pagamento ainda não está configurado.")}
        </p>

        <div className="mt-7 border-t border-border pt-5">
          <p className="text-xs leading-relaxed text-muted">
            {pick(locale, "Cada programa se paga una sola vez. No hay suscripción ni cuota mensual. La licencia es de uso permanente para la versión que comprás y no incluye futuras versiones salvo que se indique expresamente.", "Each program is paid for once. There is no subscription or monthly fee. The license grants permanent use of the version you buy; future versions are excluded unless expressly stated.", "Cada programa é pago uma única vez. Não há assinatura nem mensalidade. A licença é de uso permanente para a versão que você compra e não inclui versões futuras, salvo indicação expressa.")}
          </p>
        </div>

        <Link
          href="/programas"
          className="mt-6 inline-block text-sm font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-accent"
        >
          {pick(locale, "Seguir viendo programas", "Keep browsing programs", "Continuar vendo programas")}
        </Link>
      </div>
    </aside>
  );
}
