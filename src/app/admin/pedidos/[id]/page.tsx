import Image from "next/image";
import { notFound } from "next/navigation";
import { OrderDeliveryActions } from "@/components/admin/OrderDeliveryActions";
import { PaymentReviewActions } from "@/components/admin/PaymentReviewActions";
import { RevealLicenseButton } from "@/components/admin/RevealLicenseButton";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { requireAdminPage } from "@/features/admin/guard";
import {
  ADMIN_FULFILLMENT_LABEL,
  ADMIN_LICENSE_LABEL,
  ADMIN_MANUAL_PAYMENT_LABEL,
  ADMIN_STAGE_LABEL,
} from "@/features/admin/order-labels";
import { createLicenseService } from "@/features/licensing/license-service";
import { orderDisplayReference, orderProductSummary } from "@/features/orders/order-display";
import { findOrder } from "@/features/orders/order-service";
import {
  acceptsAdminReview,
  getOrderStage,
  isItemDownloadEnabled,
  licenseDeliveryState,
} from "@/features/payments/manual-payment-state";
import { findPaymentByOrderId } from "@/features/payments/payment-service";
import { getPaymentMethodSettings } from "@/features/settings/payment-method-settings";
import { getEmailConfiguration } from "@/lib/email/mailer";
import { formatMoney } from "@/lib/utils/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedido" };

const PAGO_LABEL: Record<string, string> = {
  not_started: "Sin iniciar",
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Devuelto",
  error: "Error",
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function fecha(value: string | null | undefined): string {
  return value === null || value === undefined
    ? "—"
    : new Date(value).toLocaleString("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Argentina/Buenos_Aires",
      });
}

/**
 * Ficha de un pedido.
 *
 * "Confirmar pago" existe solo para pagos manuales y corre en el servidor con
 * sesión de Admin. Los pagos de pasarela se siguen aprobando únicamente por un
 * evento verificado del proveedor.
 */
export default async function AdminPedidoPage({
  params,
}: PageProps<"/admin/pedidos/[id]">) {
  const { id } = await params;
  const referencia = safeDecode(id);
  await requireAdminPage(`/admin/pedidos/${encodeURIComponent(referencia)}`);

  const pedido = await findOrder(referencia);
  if (pedido === null) notFound();

  const [payment, metodos] = await Promise.all([
    findPaymentByOrderId(pedido.id),
    getPaymentMethodSettings(),
  ]);
  const licencias = createLicenseService().summary();
  const email = getEmailConfiguration();
  const stage = getOrderStage(pedido);
  const manual = pedido.manualPayment;
  const ref = orderDisplayReference(pedido);
  const metodo = manual?.method === null || manual === null ? null : metodos.find((m) => m.id === manual.method) ?? null;
  const revisable = acceptsAdminReview(pedido);
  const whatsapp = pedido.customer.whatsapp ?? null;
  const proofUrl = manual?.proof !== null && manual !== null ? `/api/admin/comprobantes/${encodeURIComponent(pedido.id)}` : null;
  const proofIsImage = manual?.proof?.contentType.startsWith("image/") ?? false;

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-10">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Pedidos", href: "/admin/pedidos" },
          { label: ref },
        ]}
      />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <h1 className="display text-3xl sm:text-4xl">Pedido {ref}</h1>
        <span
          className={`eyebrow border px-3 py-1.5 ${
            stage === "awaiting_verification"
              ? "border-accent bg-accent/15 text-accent-contrast"
              : stage === "paid" || stage === "rejected"
                ? "border-danger/60 text-danger"
                : "border-border text-foreground"
          }`}
        >
          {ADMIN_STAGE_LABEL[stage]}
        </span>
      </div>

      {revisable && manual !== null ? (
        <section
          aria-labelledby="verificar"
          className="mt-6 border border-accent/60 bg-accent/10 p-4 sm:p-6"
        >
          <h2 id="verificar" className="eyebrow text-accent-contrast">
            Verificación de pago
          </h2>
          <p className="display mt-2 text-4xl sm:text-5xl">{formatMoney(pedido.total)}</p>
          <p className="mt-1 text-sm text-muted">{orderProductSummary(pedido)}</p>

          <dl className="mt-4 grid gap-px border border-border bg-border sm:grid-cols-2">
            <Dato etiqueta="Método" valor={manual.methodLabel ?? "El cliente no eligió medio"} />
            <Dato
              etiqueta="Informado"
              valor={manual.reportedAt === null ? "El cliente todavía no tocó «Ya pagué»" : fecha(manual.reportedAt)}
            />
            {metodo !== null && metodo.alias !== null ? <Dato etiqueta="Alias donde debe entrar" valor={metodo.alias} /> : null}
            {metodo !== null && metodo.cvu !== null ? <Dato etiqueta="CVU/CBU" valor={metodo.cvu} /> : null}
          </dl>

          <div className="mt-4">
            <p className="eyebrow">Comprobante</p>
            {proofUrl === null ? (
              <p className="mt-1 text-sm text-muted">No adjuntó comprobante.</p>
            ) : proofIsImage ? (
              <a href={proofUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block">
                <Image
                  src={proofUrl}
                  alt={`Comprobante del pedido ${ref}`}
                  width={480}
                  height={640}
                  unoptimized
                  className="h-auto max-h-96 w-auto max-w-full border border-border bg-background object-contain"
                />
                <span className="mt-1 block text-xs text-muted underline">Abrir en tamaño completo</span>
              </a>
            ) : (
              <a
                href={proofUrl}
                className="mt-2 inline-flex min-h-11 items-center border border-border px-4 text-xs font-semibold uppercase tracking-wider hover:border-accent"
              >
                Descargar comprobante PDF
              </a>
            )}
            <p className="mt-2 text-xs text-muted">
              El comprobante es solo una ayuda: confirmá únicamente después de ver el ingreso en tu cuenta.
            </p>
          </div>

          <div className="mt-6">
            <PaymentReviewActions
              orderId={pedido.id}
              reference={ref}
              product={orderProductSummary(pedido)}
              amount={formatMoney(pedido.total)}
              method={manual.methodLabel ?? "Sin informar"}
            />
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel titulo="Pedido">
          <Fila etiqueta="Número" valor={ref} />
          <Fila etiqueta="Identificador interno" valor={pedido.id} />
          <Fila etiqueta="Creado" valor={fecha(pedido.createdAt)} />
          <Fila etiqueta="Actualizado" valor={fecha(pedido.updatedAt)} />
          <Fila etiqueta="Estado" valor={ADMIN_STAGE_LABEL[stage]} />
          <Fila etiqueta="Tipo de compra" valor={pedido.customer.accountId ? "Con cuenta" : "Invitado"} />
        </Panel>

        <Panel titulo="Cliente">
          <Fila etiqueta="Nombre" valor={`${pedido.customer.firstName} ${pedido.customer.lastName}`} />
          <FilaEnlace etiqueta="Email" valor={pedido.customer.email} href={`mailto:${pedido.customer.email}`} />
          {whatsapp !== null ? (
            <FilaEnlace etiqueta="WhatsApp" valor={`+${whatsapp}`} href={`https://wa.me/${whatsapp}`} externo />
          ) : (
            <Fila etiqueta="WhatsApp" valor="No informado" />
          )}
        </Panel>

        <Panel titulo="Pago">
          <Fila etiqueta="Total" valor={formatMoney(pedido.total)} />
          <Fila
            etiqueta="Método"
            valor={pedido.payment.provider === "free" ? "Gratis" : manual?.methodLabel ?? pedido.payment.provider ?? "—"}
          />
          {manual !== null ? (
            <>
              <Fila etiqueta="Estado del pago" valor={ADMIN_MANUAL_PAYMENT_LABEL[manual.status]} />
              <Fila etiqueta="Informado (Ya pagué)" valor={fecha(manual.reportedAt)} />
              <Fila etiqueta="Pagado" valor={fecha(manual.paidAt)} />
              <Fila etiqueta="Aprobado por" valor={manual.approvedBy ?? "—"} />
              {manual.status === "rejected" ? (
                <>
                  <Fila etiqueta="Rechazado" valor={`${fecha(manual.rejectedAt)} · ${manual.rejectedBy ?? ""}`} />
                  <Fila etiqueta="Motivo" valor={manual.rejectionReason ?? "—"} />
                </>
              ) : null}
            </>
          ) : (
            <Fila etiqueta="Estado del pago" valor={PAGO_LABEL[pedido.payment.status] ?? pedido.payment.status} />
          )}
          <Fila
            etiqueta="Registro técnico"
            valor={payment === null ? "Sin registro" : `${PAGO_LABEL[payment.status] ?? payment.status} · ${payment.provider}`}
          />
        </Panel>

        <Panel titulo="Licencias y entrega">
          <Fila etiqueta="Sistema de licencias" valor={`${licencias.activeProvider ?? "ninguno"} (${licencias.implementation})`} />
          <Fila etiqueta="Licencias" valor={ADMIN_LICENSE_LABEL[licenseDeliveryState(pedido.licenseStatus)]} />
          <Fila etiqueta="Asignadas" valor={fecha(pedido.fulfillment.licenseAssignedAt)} />
          <Fila etiqueta="Entrega" valor={ADMIN_FULFILLMENT_LABEL[pedido.fulfillment.status]} />
          <Fila etiqueta="Último intento" valor={fecha(pedido.fulfillment.lastAttemptAt)} />
          <Fila etiqueta="Completada" valor={fecha(pedido.fulfillment.completedAt)} />
          <Fila etiqueta="Último error" valor={pedido.fulfillment.lastError ?? "—"} />
          <Fila etiqueta="Email al cliente" valor={pedido.notifications.deliveryReadyEmailAt !== null ? `Enviado ${fecha(pedido.notifications.deliveryReadyEmailAt)}` : email.ready ? "Todavía no" : "SMTP sin configurar"} />
        </Panel>
      </div>

      <section aria-labelledby="items" className="mt-8">
        <h2 id="items" className="eyebrow text-accent-contrast">
          Lo que compró
        </h2>
        <p className="mt-2 text-xs text-muted">
          Datos congelados al momento de la compra: si después cambiás el precio o la versión, este pedido no cambia.
        </p>

        <ul className="mt-4 border-t border-border">
          {pedido.items.map((item) => (
            <li
              key={item.productId}
              className="grid gap-3 border-b border-border py-4 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.9fr)_auto]"
            >
              <div className="min-w-0">
                <p className="font-semibold">{item.name}</p>
                <p className="eyebrow mt-1">
                  versión {item.version}
                  <span className="px-2 text-border">·</span>
                  appId: {item.appId}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {item.licenseRequired ? "Lleva licencia" : "Sin licencia"}
                  <span className="px-1.5 text-border">·</span>
                  {item.platforms.length === 0 ? "Plataforma no informada" : item.platforms.join(", ")}
                </p>
              </div>
              <div className="text-sm">
                <p>Licencia: {ADMIN_LICENSE_LABEL[licenseDeliveryState(item.licenseStatus)]}</p>
                <p className="mt-1 text-muted">Asignada: {fecha(item.issuedAt)}</p>
                {item.licenseId !== null ? <p className="mt-1 break-all text-muted">ID externo: {item.licenseId}</p> : null}
                <p className="mt-1 text-muted">
                  Descarga: {isItemDownloadEnabled(pedido, item) ? `habilitada (${item.downloadFile?.fileName ?? ""})` : item.downloadFile === null ? "sin archivo asociado" : "no habilitada"}
                </p>
                {item.licenseError !== null ? <p className="mt-1 text-danger">Código: {item.licenseError}</p> : null}
                {item.licenseStatus === "issued" ? (
                  <RevealLicenseButton orderId={pedido.id} productId={item.productId} canVerify={licencias.canLookup} />
                ) : null}
              </div>
              <p className="shrink-0 lg:text-right">{formatMoney(item.unitPrice)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-5 max-w-xs space-y-3">
          <div className="flex justify-between gap-4">
            <dt className="text-sm text-muted">Subtotal</dt>
            <dd className="text-sm">{formatMoney(pedido.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-3">
            <dt className="display text-lg">Total</dt>
            <dd className="display text-2xl">{formatMoney(pedido.total)}</dd>
          </div>
        </dl>
      </section>

      <OrderDeliveryActions
        orderId={pedido.id}
        canRetry={
          pedido.status === "paid" &&
          (payment?.status ?? pedido.payment.status) === "approved" &&
          pedido.fulfillment.status !== "fulfilled"
        }
        canResend={pedido.status === "fulfilled" && email.ready}
      />
    </main>
  );
}

function Panel({
  titulo,
  children,
}: {
  readonly titulo: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-surface p-4 sm:p-5">
      <h2 className="eyebrow text-accent-contrast">{titulo}</h2>
      <dl className="mt-3">{children}</dl>
    </section>
  );
}

function Fila({ etiqueta, valor }: { readonly etiqueta: string; readonly valor: string }) {
  return (
    <div className="grid gap-1 border-b border-border py-2.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-baseline sm:gap-3">
      <dt className="eyebrow">{etiqueta}</dt>
      <dd className="min-w-0 break-words text-sm sm:text-right">{valor}</dd>
    </div>
  );
}

function FilaEnlace({
  etiqueta,
  valor,
  href,
  externo = false,
}: {
  readonly etiqueta: string;
  readonly valor: string;
  readonly href: string;
  readonly externo?: boolean;
}) {
  return (
    <div className="grid gap-1 border-b border-border py-2.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-baseline sm:gap-3">
      <dt className="eyebrow">{etiqueta}</dt>
      <dd className="min-w-0 break-all text-sm sm:text-right">
        <a
          href={href}
          {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-accent"
        >
          {valor}
        </a>
      </dd>
    </div>
  );
}

function Dato({ etiqueta, valor }: { readonly etiqueta: string; readonly valor: string }) {
  return (
    <div className="bg-background p-3">
      <dt className="eyebrow">{etiqueta}</dt>
      <dd className="mt-1 break-all text-sm font-semibold">{valor}</dd>
    </div>
  );
}
