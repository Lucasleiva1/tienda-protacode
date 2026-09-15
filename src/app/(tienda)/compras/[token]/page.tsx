import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CopyLicenseButton } from "@/components/purchases/CopyLicenseButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { findOrderByPurchaseToken } from "@/features/purchases/purchase-access";
import { allowRequest } from "@/lib/security/rate-limit";
import { formatMoney } from "@/lib/utils/money";
import type { OrderItem } from "@/types/order";
import type { Platform } from "@/types/product";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tu compra",
  robots: { index: false, follow: false, nocache: true },
};

const PLATFORM_LABEL: Record<Platform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

function publicState(item: OrderItem): { readonly title: string; readonly message: string } {
  if (item.licenseStatus === "issued" && item.downloadFile !== null) {
    return {
      title: "Entrega preparada",
      message: "Tu licencia está emitida y el archivo está listo para descargar.",
    };
  }
  if (item.licenseStatus === "issued") {
    return {
      title: "Licencia emitida",
      message: "La licencia ya está lista. Estamos terminando de preparar el archivo.",
    };
  }
  if (item.licenseStatus === "failed") {
    return {
      title: "Entrega en preparación",
      message: "Tu pago está confirmado, pero estamos terminando de preparar la entrega.",
    };
  }
  return {
    title: "Preparando tu licencia",
    message: "Estamos preparando tu licencia. No necesitás volver a pagar.",
  };
}

export default async function PurchasePage({
  params,
}: PageProps<"/compras/[token]">) {
  const { token } = await params;
  if (!allowRequest("purchase-page", token, 30, 60_000)) notFound();
  const order = await findOrderByPurchaseToken(token);
  if (order === null) notFound();

  const paymentConfirmed =
    (order.status === "paid" || order.status === "fulfilled") &&
    order.payment.status === "approved";

  return (
    <main id="contenido">
      <div className="mx-auto w-full max-w-[1100px] px-4 py-12 sm:px-6 sm:py-16 lg:px-10 lg:py-20">
        <Breadcrumb items={[{ label: "Inicio", href: "/" }, { label: "Tu compra" }]} />

        <header className="mt-8 border-b border-border pb-8 sm:mt-10 sm:pb-10">
          <p className="eyebrow text-accent-contrast">
            {paymentConfirmed ? "Compra confirmada" : "Pedido registrado"}
          </p>
          <h1 className="display mt-4 text-4xl sm:text-6xl">
            {paymentConfirmed ? "COMPRA CONFIRMADA" : "PAGO PENDIENTE"}
          </h1>
          <p className="mt-5 max-w-2xl leading-relaxed text-muted">
            {paymentConfirmed
              ? "Este es tu acceso privado y permanente a la compra. Guardá esta dirección en un lugar seguro."
              : "El pedido existe, pero el servidor todavía no confirmó el pago. No se habilitarán licencias ni archivos antes de esa confirmación."}
          </p>
        </header>

        <dl className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-3">
          <Summary label="Pedido" value={order.id.slice(0, 8).toUpperCase()} />
          <Summary label="Productos" value={String(order.items.length)} />
          <Summary label="Total" value={formatMoney(order.total)} />
        </dl>

        <section aria-labelledby="productos-compra" className="mt-10 sm:mt-12">
          <h2 id="productos-compra" className="eyebrow text-accent-contrast">
            Productos adquiridos
          </h2>

          <div className="mt-4 space-y-5">
            {order.items.map((item) => {
              const state = publicState(item);
              const platforms = item.platforms.map((platform) => PLATFORM_LABEL[platform]).join(", ");
              return (
                <article key={item.productId} className="border border-border bg-surface p-5 sm:p-7">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="display text-3xl">{item.name}</h3>
                      <p className="eyebrow mt-2">
                        versión {item.version}
                        <span className="px-2 text-border">·</span>
                        {platforms === "" ? "Plataforma no informada" : platforms}
                      </p>
                    </div>
                    <span className="eyebrow border border-border px-3 py-2 text-foreground">
                      {state.title}
                    </span>
                  </div>

                  <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
                    {paymentConfirmed
                      ? state.message
                      : "La entrega comenzará solamente cuando el proveedor de pago confirme la operación."}
                  </p>

                  {paymentConfirmed && item.licenseStatus === "issued" && item.licenseKey !== null ? (
                    <div className="mt-6 border-t border-border pt-5">
                      <p className="eyebrow">Licencia</p>
                      <code className="mt-2 block select-all break-all border border-border bg-background px-4 py-3 text-sm text-foreground">
                        {item.licenseKey}
                      </code>
                      <CopyLicenseButton licenseKey={item.licenseKey} />
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
                        Descargar {item.downloadFile.fileName}
                      </button>
                      <p className="mt-2 text-xs text-muted">
                        {(item.downloadFile.size / 1024 / 1024).toFixed(1)} MB · descarga privada
                      </p>
                    </form>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>

        <section className="mt-10 border border-border p-5 sm:p-7">
          <h2 className="eyebrow text-accent-contrast">Información de uso</h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-muted">
            La licencia corresponde a la versión indicada y es de uso permanente.
            No compartas esta página ni la clave. Si necesitás recuperar el acceso,
            contactá a soporte con la referencia corta del pedido.
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
