import { ClearPurchasedCart } from "@/components/payments/ClearPurchasedCart";
import { CopyLinkButton } from "@/components/purchases/CopyLinkButton";
import { LicenseReveal } from "@/components/purchases/LicenseReveal";
import { ManualPaymentPanel } from "@/components/purchases/ManualPaymentPanel";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { orderDisplayReference } from "@/features/orders/order-display";
import {
  getOrderStage,
  isItemDownloadEnabled,
  isPaymentConfirmed,
  licenseDeliveryState,
  type OrderStage,
} from "@/features/payments/manual-payment-state";
import type { OrderAccessInput } from "@/features/purchases/order-access";
import type { PublicPaymentMethod } from "@/features/settings/payment-method-settings";
import { numberLocale, pick, type Locale } from "@/i18n/shared";
import { formatMoney } from "@/lib/utils/money";
import type { Order, OrderItem } from "@/types/order";
import type { Platform } from "@/types/product";

const PLATFORM_LABEL: Record<Platform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

type Texts = readonly [string, string, string];

const STAGE_TEXT: Record<OrderStage, { eyebrow: Texts; title: Texts; message: Texts }> = {
  pending: {
    eyebrow: ["Pedido registrado", "Order registered", "Pedido registrado"],
    title: ["ELEGÍ CÓMO PAGAR", "CHOOSE HOW TO PAY", "ESCOLHA COMO PAGAR"],
    message: [
      "Tu pedido quedó guardado. Elegí el medio de pago y seguí las instrucciones.",
      "Your order is saved. Choose a payment method and follow the instructions.",
      "Seu pedido foi salvo. Escolha o meio de pagamento e siga as instruções.",
    ],
  },
  awaiting_payment: {
    eyebrow: ["Pedido registrado", "Order registered", "Pedido registrado"],
    title: ["REALIZÁ EL PAGO", "MAKE THE PAYMENT", "FAÇA O PAGAMENTO"],
    message: [
      "Pagá con el medio elegido y, cuando termines, tocá «Ya pagué».",
      "Pay with the chosen method and, when you are done, tap “I have paid”.",
      "Pague com o meio escolhido e, ao terminar, toque em “Já paguei”.",
    ],
  },
  awaiting_verification: {
    eyebrow: ["Pago informado", "Payment reported", "Pagamento informado"],
    title: ["VERIFICANDO TU PAGO", "VERIFYING YOUR PAYMENT", "VERIFICANDO SEU PAGAMENTO"],
    message: [
      "Estamos verificando tu pago. Cuando sea aprobado vas a poder acceder a tu licencia y descarga.",
      "We are verifying your payment. Once approved you will be able to access your license and download.",
      "Estamos verificando seu pagamento. Quando for aprovado, você poderá acessar sua licença e o download.",
    ],
  },
  paid: {
    eyebrow: ["Pago confirmado", "Payment confirmed", "Pagamento confirmado"],
    title: ["PAGO CONFIRMADO", "PAYMENT CONFIRMED", "PAGAMENTO CONFIRMADO"],
    message: [
      "Estamos terminando de preparar tu entrega. No necesitás volver a pagar.",
      "We are finishing your delivery. You do not need to pay again.",
      "Estamos terminando sua entrega. Você não precisa pagar novamente.",
    ],
  },
  completed: {
    eyebrow: ["Compra lista", "Purchase ready", "Compra pronta"],
    title: ["PAGO CONFIRMADO", "PAYMENT CONFIRMED", "PAGAMENTO CONFIRMADO"],
    message: [
      "Tu compra está lista. Guardá esta página: es tu acceso a la licencia y la descarga.",
      "Your purchase is ready. Keep this page: it is your access to the license and download.",
      "Sua compra está pronta. Guarde esta página: é seu acesso à licença e ao download.",
    ],
  },
  rejected: {
    eyebrow: ["Pago rechazado", "Payment rejected", "Pagamento recusado"],
    title: ["PAGO RECHAZADO", "PAYMENT REJECTED", "PAGAMENTO RECUSADO"],
    message: [
      "No se generó ninguna licencia para este pedido.",
      "No license was generated for this order.",
      "Nenhuma licença foi gerada para este pedido.",
    ],
  },
  cancelled: {
    eyebrow: ["Pedido cancelado", "Order cancelled", "Pedido cancelado"],
    title: ["PEDIDO CANCELADO", "ORDER CANCELLED", "PEDIDO CANCELADO"],
    message: [
      "Este pedido fue cancelado.",
      "This order was cancelled.",
      "Este pedido foi cancelado.",
    ],
  },
};

export interface OrderDetailViewProps {
  readonly order: Order;
  readonly access: OrderAccessInput;
  readonly locale: Locale;
  readonly breadcrumb: readonly { readonly label: string; readonly href?: string }[];
  readonly methods: readonly PublicPaymentMethod[];
  readonly whatsappUrl: string | null;
  /** Solo para accesos por enlace: permite copiar la dirección y avisa guardarla. */
  readonly privateLink: boolean;
}

function dateLabel(value: string | null, locale: Locale): string | null {
  return value === null
    ? null
    : new Date(value).toLocaleString(numberLocale(locale), {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Argentina/Buenos_Aires",
      });
}

export function OrderDetailView({
  order,
  access,
  locale,
  breadcrumb,
  methods,
  whatsappUrl,
  privateLink,
}: OrderDetailViewProps) {
  const t = (texts: Texts) => pick(locale, ...texts);
  const stage = getOrderStage(order);
  // Con un único medio activo no hay elección: el pedido pendiente ya es "realizá el pago".
  const onlyMethod = methods.length === 1 ? (methods[0] ?? null) : null;
  const text = STAGE_TEXT[stage === "pending" && onlyMethod !== null ? "awaiting_payment" : stage];
  const confirmed = isPaymentConfirmed(order);
  const reference = orderDisplayReference(order);
  const manual = order.manualPayment;
  const totalLabel = formatMoney(order.total, numberLocale(locale));
  const showPaymentPanel =
    manual !== null && (stage === "pending" || stage === "awaiting_payment" || stage === "awaiting_verification" || stage === "rejected");

  const paymentChip: Texts = confirmed
    ? ["Confirmado", "Confirmed", "Confirmado"]
    : stage === "awaiting_verification"
      ? ["Informado", "Reported", "Informado"]
      : stage === "rejected"
        ? ["Rechazado", "Rejected", "Recusado"]
        : ["Pendiente", "Pending", "Pendente"];
  const licenseChip = licenseSummary(order);
  const downloadEnabled = order.items.some((item) => isItemDownloadEnabled(order, item));
  const downloadChip: Texts = downloadEnabled
    ? ["Habilitada", "Enabled", "Liberado"]
    : confirmed
      ? ["En preparación", "Being prepared", "Em preparação"]
      : ["Después del pago", "After payment", "Após o pagamento"];

  return (
    <main>
      <div className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6 sm:py-14 lg:px-10 lg:py-20">
        <Breadcrumb locale={locale} items={breadcrumb} />

        <header className="mt-8 border-b border-border pb-8 sm:mt-10">
          <p className="eyebrow text-accent-contrast">{t(text.eyebrow)}</p>
          <h1 className="display mt-4 text-4xl sm:text-6xl">{t(text.title)}</h1>
          <p className="mt-5 max-w-2xl leading-relaxed text-muted">{t(text.message)}</p>
        </header>

        <dl className="mt-8 grid grid-cols-2 gap-px border border-border bg-border lg:grid-cols-4">
          <Summary label={t(["Pedido", "Order", "Pedido"])} value={reference} />
          <Summary label={t(["Fecha", "Date", "Data"])} value={dateLabel(order.createdAt, locale) ?? "—"} />
          <Summary label="Total" value={totalLabel} />
          <Summary
            label={t(["Método de pago", "Payment method", "Meio de pagamento"])}
            value={
              order.payment.provider === "free"
                ? t(["Gratis", "Free", "Grátis"])
                : manual?.methodLabel ?? onlyMethod?.name ?? t(["Sin elegir", "Not chosen", "Não escolhido"])
            }
          />
        </dl>

        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          <StatusChip label={t(["Pago", "Payment", "Pagamento"])} value={t(paymentChip)} good={confirmed} />
          <StatusChip label={t(["Licencia", "License", "Licença"])} value={t(licenseChip)} good={licenseChip[0] === "Asignada" || licenseChip[0] === "No requiere"} />
          <StatusChip label={t(["Descarga", "Download", "Download"])} value={t(downloadChip)} good={downloadEnabled} />
        </ul>

        {showPaymentPanel && manual !== null ? (
          <div className="mt-8">
            <ManualPaymentPanel
              access={access}
              locale={locale}
              reference={reference}
              totalLabel={totalLabel}
              status={manual.status}
              selectedMethod={manual.method}
              methodLabel={manual.methodLabel}
              reportedAtLabel={dateLabel(manual.reportedAt, locale)}
              proofUploaded={manual.proof !== null}
              rejectionReason={manual.rejectionReason}
              methods={methods}
              whatsappUrl={whatsappUrl}
            />
          </div>
        ) : null}

        <section aria-labelledby="productos-pedido" className="mt-10">
          <h2 id="productos-pedido" className="eyebrow text-accent-contrast">
            {t(["Productos", "Products", "Produtos"])}
          </h2>
          <div className="mt-4 space-y-5">
            {order.items.map((item) => (
              <ItemCard key={item.productId} order={order} item={item} access={access} locale={locale} />
            ))}
          </div>
        </section>

        {privateLink ? (
          <section className="mt-10 border border-border p-5 sm:p-7">
            <h2 className="eyebrow text-accent-contrast">{t(["Tu enlace privado", "Your private link", "Seu link privado"])}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
              {t([
                "Esta dirección es tu acceso al pedido. Guardala y no la compartas. Si la perdés, podés recuperarla con tu email y el número de pedido.",
                "This address is your access to the order. Keep it and do not share it. If you lose it, you can recover it with your email and order number.",
                "Este endereço é seu acesso ao pedido. Guarde-o e não compartilhe. Se perder, você pode recuperá-lo com seu e-mail e o número do pedido.",
              ])}
            </p>
            <CopyLinkButton locale={locale} />
          </section>
        ) : null}

        <section className="mt-10 border border-border p-5 sm:p-7">
          <h2 className="eyebrow text-accent-contrast">{t(["Información de uso", "Usage information", "Informações de uso"])}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            {t([
              "La licencia corresponde a la versión indicada y es de uso permanente. No compartas esta página ni la clave. Si necesitás ayuda, escribinos con el número de pedido.",
              "The license applies to the version shown and grants permanent use. Do not share this page or the key. If you need help, contact us with the order number.",
              "A licença corresponde à versão indicada e é de uso permanente. Não compartilhe esta página nem a chave. Se precisar de ajuda, fale conosco com o número do pedido.",
            ])}
          </p>
        </section>
      </div>
      {confirmed ? <ClearPurchasedCart slugs={order.items.map((item) => item.slug)} /> : null}
    </main>
  );
}

function licenseSummary(order: Order): Texts {
  const states = order.items.map((item) => licenseDeliveryState(item.licenseStatus));
  if (states.every((state) => state === "not_required")) return ["No requiere", "Not required", "Não requer"];
  const required = states.filter((state) => state !== "not_required");
  if (required.every((state) => state === "assigned")) return ["Asignada", "Assigned", "Atribuída"];
  if (required.some((state) => state === "assigning" || state === "failed")) {
    return ["En preparación", "Being prepared", "Em preparação"];
  }
  return ["Después del pago", "After payment", "Após o pagamento"];
}

function ItemCard({
  order,
  item,
  access,
  locale,
}: {
  readonly order: Order;
  readonly item: OrderItem;
  readonly access: OrderAccessInput;
  readonly locale: Locale;
}) {
  const t = (texts: Texts) => pick(locale, ...texts);
  const confirmed = isPaymentConfirmed(order);
  const platforms = item.platforms.map((platform) => PLATFORM_LABEL[platform]).join(", ");
  const downloadReady = isItemDownloadEnabled(order, item);

  return (
    <article className="border border-border bg-surface p-5 sm:p-7">
      <h3 className="display text-3xl">{item.name}</h3>
      <p className="eyebrow mt-2">
        {t(["versión", "version", "versão"])} {item.version}
        <span className="px-2 text-border">·</span>
        {platforms === "" ? t(["Plataforma no informada", "Platform not specified", "Plataforma não informada"]) : platforms}
        <span className="px-2 text-border">·</span>
        {formatMoney(item.unitPrice, numberLocale(locale))}
      </p>

      {confirmed ? (
        <div className="mt-6 space-y-6 border-t border-border pt-5">
          {item.licenseStatus === "issued" && item.licenseKey !== null ? (
            <LicenseReveal licenseKey={item.licenseKey} locale={locale} />
          ) : item.licenseStatus === "not_required" ? (
            <p className="text-sm text-muted">
              {t(["Este programa no requiere licencia.", "This program does not require a license.", "Este programa não requer licença."])}
            </p>
          ) : (
            <p className="text-sm text-muted">
              {t([
                "Tu pago está confirmado. Estamos preparando la licencia; no necesitás volver a pagar.",
                "Your payment is confirmed. We are preparing the license; you do not need to pay again.",
                "Seu pagamento está confirmado. Estamos preparando a licença; você não precisa pagar novamente.",
              ])}
            </p>
          )}

          {downloadReady && item.downloadFile !== null ? (
            <form
              method="post"
              action={`/api/downloads/${encodeURIComponent(order.id)}/${encodeURIComponent(item.productId)}`}
            >
              {access.kind === "token" ? (
                <input type="hidden" name="purchaseToken" value={access.token} />
              ) : null}
              <button
                type="submit"
                className="min-h-12 w-full bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wider text-accent-foreground transition-colors hover:bg-accent-contrast sm:w-auto"
              >
                {t(["Descargar aplicación", "Download application", "Baixar aplicativo"])}
              </button>
              <p className="mt-2 break-all text-xs text-muted">
                {item.downloadFile.fileName} · {(item.downloadFile.size / 1024 / 1024).toFixed(1)} MB ·{" "}
                {t(["descarga privada", "private download", "download privado"])}
              </p>
            </form>
          ) : (
            <p className="text-sm text-muted">
              {t([
                "La descarga va a aparecer acá apenas esté lista.",
                "The download will appear here as soon as it is ready.",
                "O download aparecerá aqui assim que estiver pronto.",
              ])}
            </p>
          )}
        </div>
      ) : (
        <p className="mt-5 text-sm leading-relaxed text-muted">
          {t([
            "La licencia y la descarga se habilitan cuando confirmemos tu pago.",
            "The license and download are enabled once we confirm your payment.",
            "A licença e o download são liberados quando confirmarmos seu pagamento.",
          ])}
        </p>
      )}
    </article>
  );
}

function Summary({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="bg-surface p-4 sm:p-5">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-2 break-words font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function StatusChip({ label, value, good }: { readonly label: string; readonly value: string; readonly good: boolean }) {
  return (
    <li className={`flex items-center justify-between gap-3 border px-4 py-3 ${good ? "border-accent/60 bg-accent/10" : "border-border bg-surface"}`}>
      <span className="eyebrow">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </li>
  );
}

