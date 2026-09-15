import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { OrderDeliveryActions } from "@/components/admin/OrderDeliveryActions";
import { RevealLicenseButton } from "@/components/admin/RevealLicenseButton";
import { requireAdminPage } from "@/features/admin/guard";
import { findOrder } from "@/features/orders/order-service";
import { findPaymentByOrderId } from "@/features/payments/payment-service";
import { formatMoney } from "@/lib/utils/money";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedido" };

const ORDER_LABEL: Record<string, string> = {
  pending: "Pendiente de pago",
  paid: "Pagado",
  failed: "Fallido",
  cancelled: "Cancelado",
  fulfilled: "Entregado",
};

const PAGO_LABEL: Record<string, string> = {
  not_started: "Sin iniciar",
  pending: "Pendiente",
  approved: "Aprobado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
  refunded: "Devuelto",
  error: "Error",
};

const LICENCIA_LABEL: Record<string, string> = {
  not_requested: "No solicitada",
  pending: "Pendiente",
  issued: "Emitida",
  failed: "Falló",
};

const FULFILLMENT_LABEL: Record<string, string> = {
  not_started: "Sin iniciar",
  pending: "Procesando",
  partial: "Parcial",
  failed: "Requiere reintento",
  fulfilled: "Completado",
};

/**
 * Ficha de un pedido.
 *
 * No existe botón para marcar como pagado. El estado de pago solo puede cambiarlo
 * un proveedor real, verificado por el servidor: si se pudiera marcar a mano, un
 * error de clic entregaría una licencia sin cobrar.
 */
export default async function AdminPedidoPage({
  params,
}: PageProps<"/admin/pedidos/[id]">) {
  await requireAdminPage();

  const { id } = await params;
  const pedido = await findOrder(id);

  if (pedido === null) notFound();
  const payment = await findPaymentByOrderId(pedido.id);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-10 sm:px-6">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Pedidos", href: "/admin/pedidos" },
          { label: pedido.id.slice(0, 8).toUpperCase() },
        ]}
      />

      <h1 className="display mt-6 text-4xl">
        Pedido {pedido.id.slice(0, 8).toUpperCase()}
      </h1>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Panel titulo="Pedido">
          <Fila etiqueta="Identificador" valor={pedido.id} />
          <Fila
            etiqueta="Creado"
            valor={new Date(pedido.createdAt).toLocaleString("es-AR")}
          />
          <Fila
            etiqueta="Actualizado"
            valor={new Date(pedido.updatedAt).toLocaleString("es-AR")}
          />
          <Fila
            etiqueta="Estado"
            valor={ORDER_LABEL[pedido.status] ?? pedido.status}
          />
        </Panel>

        <Panel titulo="Cliente">
          <Fila etiqueta="Nombre" valor={pedido.customer.firstName} />
          <Fila etiqueta="Apellido" valor={pedido.customer.lastName} />
          <Fila etiqueta="Email" valor={pedido.customer.email} />
        </Panel>

        <Panel titulo="Pago">
          <Fila
            etiqueta="Estado"
            valor={PAGO_LABEL[payment?.status ?? pedido.payment.status] ?? (payment?.status ?? pedido.payment.status)}
          />
          <Fila
            etiqueta="Proveedor"
            valor={payment?.provider ?? pedido.payment.provider ?? "No configurado"}
          />
          <Fila
            etiqueta="External payment ID"
            valor={payment?.externalPaymentId ?? pedido.payment.providerReference ?? "—"}
          />
          <Fila
            etiqueta="Importe"
            valor={payment === null ? "—" : formatMoney(payment.amount)}
          />
          <Fila etiqueta="Moneda" valor={payment?.amount.currency ?? pedido.currency} />
          <Fila
            etiqueta="Creado"
            valor={payment === null ? "—" : new Date(payment.createdAt).toLocaleString("es-AR")}
          />
          <Fila
            etiqueta="Aprobado"
            valor={payment?.approvedAt === null || payment === null
              ? "—"
              : new Date(payment.approvedAt).toLocaleString("es-AR")}
          />
          {payment?.failureReason !== null && payment?.failureReason !== undefined ? (
            <Fila etiqueta="Motivo técnico" valor={payment.failureReason} />
          ) : null}
        </Panel>

        <Panel titulo="Fulfillment">
          <Fila
            etiqueta="Estado"
            valor={FULFILLMENT_LABEL[pedido.fulfillment.status] ?? pedido.fulfillment.status}
          />
          <Fila
            etiqueta="Licencias"
            valor={LICENCIA_LABEL[pedido.licenseStatus] ?? pedido.licenseStatus}
          />
          <Fila
            etiqueta="Último intento"
            valor={pedido.fulfillment.lastAttemptAt === null
              ? "—"
              : new Date(pedido.fulfillment.lastAttemptAt).toLocaleString("es-AR")}
          />
          <Fila
            etiqueta="Completado"
            valor={pedido.fulfillment.completedAt === null
              ? "—"
              : new Date(pedido.fulfillment.completedAt).toLocaleString("es-AR")}
          />
          <Fila etiqueta="Último estado técnico" valor={pedido.fulfillment.lastError ?? "—"} />
        </Panel>
      </div>

      <section aria-labelledby="items" className="mt-10">
        <h2 id="items" className="eyebrow text-accent-contrast">
          Lo que compró
        </h2>
        <p className="mt-2 text-xs text-muted">
          Estos datos quedaron congelados al momento de la compra. Si después cambiás
          el precio o la versión del programa, este pedido no se modifica.
        </p>

        <ul className="mt-4 border-t border-border">
          {pedido.items.map((item) => (
            <li
              key={item.productId}
              className="grid gap-4 border-b border-border py-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.7fr)_auto]"
            >
              <div className="min-w-0">
                <p className="font-semibold">{item.name}</p>
                <p className="eyebrow mt-1">
                  versión {item.version}
                  <span className="px-2 text-border">·</span>
                  appId: {item.appId}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {item.platforms.length === 0 ? "Plataforma no informada" : item.platforms.join(", ")}
                </p>
              </div>
              <div className="text-sm">
                <p>
                  Licencia: {LICENCIA_LABEL[item.licenseStatus] ?? item.licenseStatus}
                </p>
                <p className="mt-1 text-muted">
                  Emitida: {item.issuedAt === null ? "—" : new Date(item.issuedAt).toLocaleString("es-AR")}
                </p>
                <p className="mt-1 text-muted">
                  Descarga: {item.downloadFile === null ? "No configurada" : item.downloadFile.fileName}
                </p>
                {item.licenseError !== null ? (
                  <p className="mt-1 text-danger">Código: {item.licenseError}</p>
                ) : null}
                {item.licenseStatus === "issued" ? (
                  <RevealLicenseButton orderId={pedido.id} productId={item.productId} />
                ) : null}
              </div>
              <p className="shrink-0 lg:text-right">{formatMoney(item.unitPrice)}</p>
            </li>
          ))}
        </ul>

        <dl className="mt-6 max-w-xs space-y-3">
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
    <section className="border border-border bg-surface p-5">
      <h2 className="eyebrow text-accent-contrast">{titulo}</h2>
      <dl className="mt-3">{children}</dl>
    </section>
  );
}

function Fila({
  etiqueta,
  valor,
}: {
  readonly etiqueta: string;
  readonly valor: string;
}) {
  return (
    <div className="grid gap-1 border-b border-border py-2.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-baseline sm:gap-3">
      <dt className="eyebrow">{etiqueta}</dt>
      <dd className="min-w-0 break-all text-sm sm:text-right">{valor}</dd>
    </div>
  );
}
