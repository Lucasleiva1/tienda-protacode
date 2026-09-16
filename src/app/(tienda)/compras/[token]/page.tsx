import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyLicenseButton } from "@/components/purchases/CopyLicenseButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { findOrderByPurchaseToken } from "@/features/purchases/purchase-access";
import { allowRequest } from "@/lib/security/rate-limit";
import { formatMoney } from "@/lib/utils/money";
import { getLocale } from "@/i18n/server";
import { numberLocale, pick, type Locale } from "@/i18n/shared";
import type { OrderItem } from "@/types/order";
import type { Platform } from "@/types/product";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: pick(locale, "Tu compra", "Your purchase", "Sua compra"),
    robots: { index: false, follow: false, nocache: true },
  };
}

const PLATFORM_LABEL: Record<Platform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

function publicState(
  item: OrderItem,
  locale: Locale,
): { readonly title: string; readonly message: string } {
  if (item.licenseStatus === "issued" && item.downloadFile !== null) {
    return {
      title: pick(locale, "Entrega preparada", "Delivery ready", "Entrega pronta"),
      message: pick(locale, "Tu licencia está emitida y el archivo está listo para descargar.", "Your license has been issued and the file is ready to download.", "Sua licença foi emitida e o arquivo está pronto para baixar."),
    };
  }
  if (item.licenseStatus === "issued") {
    return {
      title: pick(locale, "Licencia emitida", "License issued", "Licença emitida"),
      message: pick(locale, "La licencia ya está lista. Estamos terminando de preparar el archivo.", "Your license is ready. We are finishing preparing the file.", "A licença já está pronta. Estamos terminando de preparar o arquivo."),
    };
  }
  if (item.licenseStatus === "failed") {
    return {
      title: pick(locale, "Entrega en preparación", "Delivery in progress", "Entrega em preparação"),
      message: pick(locale, "Tu pago está confirmado, pero estamos terminando de preparar la entrega.", "Your payment is confirmed, but we are still preparing the delivery.", "Seu pagamento está confirmado, mas ainda estamos preparando a entrega."),
    };
  }
  return {
    title: pick(locale, "Preparando tu licencia", "Preparing your license", "Preparando sua licença"),
    message: pick(locale, "Estamos preparando tu licencia. No necesitás volver a pagar.", "We are preparing your license. You do not need to pay again.", "Estamos preparando sua licença. Você não precisa pagar de novo."),
  };
}

export default async function PurchasePage({
  params,
}: PageProps<"/compras/[token]">) {
  const { token } = await params;
  const locale = await getLocale();
  if (!allowRequest("purchase-page", token, 30, 60_000)) notFound();
  const order = await findOrderByPurchaseToken(token);
  if (order === null) notFound();

  const paymentConfirmed =
    (order.status === "paid" || order.status === "fulfilled") &&
    order.payment.status === "approved";

  return (
    <main id="contenido">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-12 sm:px-6 sm:py-16 lg:px-10 lg:py-20">
        <Breadcrumb
          locale={locale}
          items={[{ label: pick(locale, "Inicio", "Home", "Início"), href: "/" }, { label: pick(locale, "Tu compra", "Your purchase", "Sua compra") }]}
        />

        <header className="mt-8 border-b border-border pb-8 sm:mt-10 sm:pb-10">
          <p className="eyebrow text-accent-contrast">
            {paymentConfirmed ? pick(locale, "Compra confirmada", "Purchase confirmed", "Compra confirmada") : pick(locale, "Pedido registrado", "Order registered", "Pedido registrado")}
          </p>
          <h1 className="display mt-4 text-4xl sm:text-6xl">
            {paymentConfirmed ? pick(locale, "COMPRA CONFIRMADA", "PURCHASE CONFIRMED", "COMPRA CONFIRMADA") : pick(locale, "PAGO PENDIENTE", "PAYMENT PENDING", "PAGAMENTO PENDENTE")}
          </h1>
          <p className="mt-5 max-w-2xl leading-relaxed text-muted">
            {paymentConfirmed
              ? pick(locale, "Este es tu acceso privado y permanente a la compra. Guardá esta dirección en un lugar seguro.", "This is your private, permanent access to your purchase. Keep this address somewhere safe.", "Este é o seu acesso privado e permanente à compra. Guarde este endereço em um lugar seguro.")
              : pick(locale, "El pedido existe, pero el servidor todavía no confirmó el pago. No se habilitarán licencias ni archivos antes de esa confirmación.", "The order exists, but the server has not confirmed the payment yet. Licenses and files will not be enabled before that confirmation.", "O pedido existe, mas o servidor ainda não confirmou o pagamento. Licenças e arquivos não serão liberados antes dessa confirmação.")}
          </p>
        </header>

        <dl className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-3">
          <Summary label={pick(locale, "Pedido", "Order", "Pedido")} value={order.id.slice(0, 8).toUpperCase()} />
          <Summary label={pick(locale, "Productos", "Products", "Produtos")} value={String(order.items.length)} />
          <Summary label="Total" value={formatMoney(order.total, numberLocale(locale))} />
        </dl>

        <section aria-labelledby="productos-compra" className="mt-10 sm:mt-12">
          <h2 id="productos-compra" className="eyebrow text-accent-contrast">
            {pick(locale, "Productos adquiridos", "Purchased products", "Produtos adquiridos")}
          </h2>

          <div className="mt-4 space-y-5">
            {order.items.map((item) => {
              const state = publicState(item, locale);
              const platforms = item.platforms.map((platform) => PLATFORM_LABEL[platform]).join(", ");
              return (
                <article key={item.productId} className="border border-border bg-surface p-5 sm:p-7">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="display text-3xl">{item.name}</h3>
                      <p className="eyebrow mt-2">
                        {pick(locale, "versión", "version", "versão")} {item.version}
                        <span className="px-2 text-border">·</span>
                        {platforms === "" ? pick(locale, "Plataforma no informada", "Platform not specified", "Plataforma não informada") : platforms}
                      </p>
                    </div>
                    <span className="eyebrow border border-border px-3 py-2 text-foreground">
                      {state.title}
                    </span>
                  </div>

                  <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
                    {paymentConfirmed
                      ? state.message
                      : pick(locale, "La entrega comenzará solamente cuando el proveedor de pago confirme la operación.", "Delivery will start only when the payment provider confirms the transaction.", "A entrega só começará quando o provedor de pagamento confirmar a operação.")}
                  </p>

                  {paymentConfirmed && item.licenseStatus === "issued" && item.licenseKey !== null ? (
                    <div className="mt-6 border-t border-border pt-5">
                      <p className="eyebrow">{pick(locale, "Licencia", "License", "Licença")}</p>
                      <code className="mt-2 block select-all break-all border border-border bg-background px-4 py-3 text-sm text-foreground">
                        {item.licenseKey}
                      </code>
                      <CopyLicenseButton licenseKey={item.licenseKey} locale={locale} />
                    </div>
                  ) : null}

                  {paymentConfirmed && item.downloadFile !== null && item.downloadEnabledAt !== null ? (
                    <form
                      method="post"
                      action={`/api/downloads/${encodeURIComponent(order.id)}/${encodeURIComponent(item.productId)}`}
                      className="mt-6 border-t border-border pt-5"
                    >
                      <input type="hidden" name="purchaseToken" value={token} />
                      <button
                        type="submit"
                        className="bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wider text-accent-foreground transition-colors hover:bg-accent-contrast"
                      >
                        {pick(locale, "Descargar", "Download", "Baixar")} {item.downloadFile.fileName}
                      </button>
                      <p className="mt-2 text-xs text-muted">
                        {(item.downloadFile.size / 1024 / 1024).toFixed(1)} MB · {pick(locale, "descarga privada", "private download", "download privado")}
                      </p>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-10 border border-border p-5 sm:p-7">
          <h2 className="eyebrow text-accent-contrast">{pick(locale, "Información de uso", "Usage information", "Informações de uso")}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            {pick(locale, "La licencia corresponde a la versión indicada y es de uso permanente. No compartas esta página ni la clave. Si necesitás recuperar el acceso, contactá a soporte con la referencia corta del pedido.", "The license applies to the version shown and grants permanent use. Do not share this page or the key. If you need to recover access, contact support with the short order reference.", "A licença corresponde à versão indicada e é de uso permanente. Não compartilhe esta página nem a chave. Se precisar recuperar o acesso, entre em contato com o suporte informando a referência curta do pedido.")}
          </p>
        </section>
      </div>
    </main>
  );
}

function Summary({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="bg-surface p-4 sm:p-5">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-2 break-all font-semibold text-foreground">{value}</dd>
    </div>
  );
}
