import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LicenseReveal } from "@/components/purchases/LicenseReveal";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { getCurrentCustomerAccount } from "@/features/accounts/customer-session";
import { orderDisplayReference } from "@/features/orders/order-display";
import { findOrdersByAccount } from "@/features/orders/persistent-order-repository";
import {
  getOrderStage,
  isItemDownloadEnabled,
  isPaymentConfirmed,
  licenseDeliveryState,
  type LicenseDeliveryState,
  type OrderStage,
} from "@/features/payments/manual-payment-state";
import { getLocale } from "@/i18n/server";
import { numberLocale, pick, type Locale } from "@/i18n/shared";
import { formatMoney } from "@/lib/utils/money";
import type { Order } from "@/types/order";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: pick(locale, "Mis compras", "My purchases", "Minhas compras"),
    robots: { index: false, follow: false, nocache: true },
  };
}

type Texts = readonly [string, string, string];

const STAGE_LABEL: Record<OrderStage, Texts> = {
  pending: ["Falta elegir el pago", "Choose a payment method", "Falta escolher o pagamento"],
  awaiting_payment: ["Esperando el pago", "Awaiting payment", "Aguardando pagamento"],
  awaiting_verification: ["Verificando el pago", "Verifying payment", "Verificando pagamento"],
  paid: ["Pago confirmado", "Payment confirmed", "Pagamento confirmado"],
  completed: ["Lista", "Ready", "Pronta"],
  rejected: ["Pago rechazado", "Payment rejected", "Pagamento recusado"],
  cancelled: ["Cancelado", "Cancelled", "Cancelado"],
};

const LICENSE_LABEL: Record<LicenseDeliveryState, Texts> = {
  pending: ["Después del pago", "After payment", "Após o pagamento"],
  assigning: ["En preparación", "Being prepared", "Em preparação"],
  assigned: ["Asignada", "Assigned", "Atribuída"],
  failed: ["En preparación", "Being prepared", "Em preparação"],
  not_required: ["No requiere", "Not required", "Não requer"],
};

/**
 * Mis compras.
 *
 * Solo con sesión, y solo los pedidos cuyo `accountId` es el de la cuenta
 * autenticada. El filtro lo hace el servidor; la URL no puede pedir otros.
 */
export default async function MyPurchasesPage() {
  const locale = await getLocale();
  const account = await getCurrentCustomerAccount();
  if (account === null) redirect("/cuenta/iniciar-sesion?next=/cuenta/compras");

  const orders = await findOrdersByAccount(account.id);
  const t = (texts: Texts) => pick(locale, ...texts);

  return (
    <main>
      <div className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-20">
        <Breadcrumb
          locale={locale}
          items={[
            { label: t(["Inicio", "Home", "Início"]), href: "/" },
            { label: t(["Mi cuenta", "My account", "Minha conta"]), href: "/cuenta" },
            { label: t(["Mis compras", "My purchases", "Minhas compras"]) },
          ]}
        />
        <header className="mt-8 border-b border-border pb-8">
          <p className="eyebrow text-accent-contrast">{account.email}</p>
          <h1 className="display mt-4 text-4xl sm:text-6xl">{t(["MIS COMPRAS", "MY PURCHASES", "MINHAS COMPRAS"])}</h1>
        </header>

        {orders.length === 0 ? (
          <div className="mt-10 border border-border bg-surface px-6 py-12 text-center">
            <p className="text-sm text-muted">
              {t(["Todavía no tenés compras asociadas a esta cuenta.", "You have no purchases linked to this account yet.", "Você ainda não tem compras vinculadas a esta conta."])}
            </p>
            <Link
              href="/programas"
              className="mt-6 inline-block bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wider text-accent-foreground hover:bg-accent-contrast"
            >
              {t(["Ver programas", "View programs", "Ver programas"])}
            </Link>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {orders.map((order) => (
              <PurchaseRow key={order.id} order={order} locale={locale} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function PurchaseRow({ order, locale }: { readonly order: Order; readonly locale: Locale }) {
  const t = (texts: Texts) => pick(locale, ...texts);
  const stage = getOrderStage(order);
  const confirmed = isPaymentConfirmed(order);
  const reference = orderDisplayReference(order);
  const href = `/cuenta/compras/${encodeURIComponent(order.reference ?? order.id)}`;
  const method =
    order.payment.provider === "free"
      ? t(["Gratis", "Free", "Grátis"])
      : order.manualPayment?.methodLabel ?? t(["Sin elegir", "Not chosen", "Não escolhido"]);

  return (
    <li className={`border bg-surface p-5 sm:p-6 ${stage === "awaiting_verification" ? "border-accent/60" : "border-border"}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow text-accent-contrast">{reference}</p>
          <p className="mt-1 text-lg font-semibold">{order.items.map((item) => item.name).join(", ")}</p>
          <p className="mt-1 text-sm text-muted">
            {new Date(order.createdAt).toLocaleDateString(numberLocale(locale), { timeZone: "America/Argentina/Buenos_Aires" })}
            <span className="px-2 text-border">·</span>
            {formatMoney(order.total, numberLocale(locale))}
            <span className="px-2 text-border">·</span>
            {method}
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center border border-border px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-accent"
        >
          {t(["Ver pedido", "View order", "Ver pedido"])}
        </Link>
      </div>

      <dl className="mt-4 grid gap-px border border-border bg-border sm:grid-cols-3">
        <Cell label={t(["Pago", "Payment", "Pagamento"])} value={t(STAGE_LABEL[stage])} />
        <Cell
          label={t(["Licencia", "License", "Licença"])}
          value={order.items
            .map((item) => t(LICENSE_LABEL[confirmed ? licenseDeliveryState(item.licenseStatus) : "pending"]))
            .join(" · ")}
        />
        <Cell
          label={t(["Descarga", "Download", "Download"])}
          value={
            order.items.some((item) => isItemDownloadEnabled(order, item))
              ? t(["Habilitada", "Enabled", "Liberado"])
              : confirmed
                ? t(["En preparación", "Being prepared", "Em preparação"])
                : t(["Después del pago", "After payment", "Após o pagamento"])
          }
        />
      </dl>

      {confirmed
        ? order.items.map((item) => (
            <div key={item.productId} className="mt-5 grid gap-4 border-t border-border pt-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              {item.licenseStatus === "issued" && item.licenseKey !== null ? (
                <LicenseReveal licenseKey={item.licenseKey} locale={locale} />
              ) : (
                <p className="text-sm text-muted">{item.name}</p>
              )}
              {isItemDownloadEnabled(order, item) ? (
                <form
                  method="post"
                  action={`/api/downloads/${encodeURIComponent(order.id)}/${encodeURIComponent(item.productId)}`}
                >
                  <button
                    type="submit"
                    className="min-h-11 w-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent-foreground transition-colors hover:bg-accent-contrast lg:w-auto"
                  >
                    {t(["Descargar", "Download", "Baixar"])}
                  </button>
                </form>
              ) : null}
            </div>
          ))
        : null}
    </li>
  );
}

function Cell({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="bg-background p-3">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}
