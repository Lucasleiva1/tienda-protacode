import Link from "next/link";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { numberLocale, pick, type Locale } from "@/i18n/shared";
import { formatMoney } from "@/lib/utils/money";
import type { Order } from "@/types/order";

const ORDER_LABEL: Record<Order["status"], readonly [string, string, string]> = {
  pending: ["Pendiente", "Pending", "Pendente"],
  paid: ["Pagado", "Paid", "Pago"],
  failed: ["Fallido", "Failed", "Falhou"],
  cancelled: ["Cancelado", "Cancelled", "Cancelado"],
  fulfilled: ["Entregado", "Delivered", "Entregue"],
};

interface PaymentStatusCardProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly message: string;
  readonly order: Order | null;
  readonly locale: Locale;
  readonly secondaryHref?: string;
  readonly secondaryLabel?: string;
}

export function PaymentStatusCard({
  eyebrow,
  title,
  message,
  order,
  locale,
  secondaryHref = "/carrito",
  secondaryLabel,
}: PaymentStatusCardProps) {
  return (
    <main id="contenido">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6 sm:py-14 lg:px-10 lg:py-20">
        <Breadcrumb
          locale={locale}
          items={[
            { label: pick(locale, "Inicio", "Home", "Início"), href: "/" },
            { label: pick(locale, "Carrito", "Cart", "Carrinho"), href: "/carrito" },
            { label: eyebrow },
          ]}
        />

        <div className="mt-8 max-w-2xl sm:mt-10">
          <div className="border border-border bg-surface">
            <div aria-hidden="true" className="h-px bg-accent/70" />
            <div className="p-5 sm:p-8 lg:p-10">
              <p className="eyebrow text-accent-contrast">{eyebrow}</p>
              <h1 className="display mt-5 text-4xl sm:text-5xl">{title}</h1>
              <p className="mt-6 leading-relaxed text-muted">{message}</p>

              {order !== null ? (
                <dl className="mt-8 border-t border-border sm:mt-9">
                  <Row label={pick(locale, "Referencia", "Reference", "Referência")} value={order.id.slice(0, 8).toUpperCase()} />
                  <Row
                    label={pick(locale, "Estado del pedido", "Order status", "Status do pedido")}
                    value={pick(locale, ...ORDER_LABEL[order.status])}
                  />
                  <Row label="Total" value={formatMoney(order.total, numberLocale(locale))} />
                </dl>
              ) : (
                <p className="mt-8 border border-border px-4 py-3 text-sm leading-relaxed text-muted">
                  {pick(
                    locale,
                    "No pudimos recuperar un pedido válido con esta referencia.",
                    "We could not find a valid order with this reference.",
                    "Não foi possível encontrar um pedido válido com esta referência.",
                  )}
                </p>
              )}

              <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap">
                <Link
                  href="/programas"
                  className="bg-accent px-6 py-3.5 text-center text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast"
                >
                  {pick(locale, "Ver programas", "View programs", "Ver programas")}
                </Link>
                <Link
                  href={secondaryHref}
                  className="border border-border px-6 py-3.5 text-center text-sm font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-accent"
                >
                  {secondaryLabel ?? pick(locale, "Volver al carrito", "Back to cart", "Voltar ao carrinho")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="grid gap-1 border-b border-border py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-baseline sm:gap-4">
      <dt className="eyebrow">{label}</dt>
      <dd className="min-w-0 break-all text-sm text-foreground sm:text-right">{value}</dd>
    </div>
  );
}
