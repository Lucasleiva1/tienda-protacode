import Link from "next/link";
import { PushNotificationsPanel } from "@/components/admin/PushNotificationsPanel";
import { requireAdminPage } from "@/features/admin/guard";
import { getPushSubscriptionRepository } from "@/features/notifications/push-subscription-repository";
import {
  adminOrderPath,
  orderDisplayReference,
  orderProductSummary,
} from "@/features/orders/order-display";
import { findAllOrders } from "@/features/orders/persistent-order-repository";
import { getOrderStage, type OrderStage } from "@/features/payments/manual-payment-state";
import { getProducts } from "@/features/products/queries";
import { getPushConfiguration } from "@/lib/push/web-push-sender";
import { formatMoney } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

export const metadata = { title: "Resumen" };

function relative(value: string | null): string {
  if (value === null) return "";
  const minutes = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 60_000));
  if (minutes < 1) return "recién";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} días`;
}

/**
 * Inicio del panel.
 *
 * Pensado primero para el celular: lo primero que se ve son los pagos que el
 * cliente ya informó y esperan verificación.
 */
export default async function AdminInicioPage() {
  await requireAdminPage();

  const push = getPushConfiguration();
  const [productos, pedidos, dispositivos] = await Promise.all([
    getProducts(),
    findAllOrders(),
    push.ready ? getPushSubscriptionRepository().list() : Promise.resolve([]),
  ]);

  const stages = new Map(pedidos.map((pedido) => [pedido.id, getOrderStage(pedido)]));
  const count = (stage: OrderStage) => pedidos.filter((p) => stages.get(p.id) === stage).length;

  // Los más antiguos primero: son los que más esperan.
  const porVerificar = pedidos
    .filter((pedido) => stages.get(pedido.id) === "awaiting_verification")
    .sort((a, b) =>
      (a.manualPayment?.reportedAt ?? a.createdAt).localeCompare(b.manualPayment?.reportedAt ?? b.createdAt),
    );
  const entregasPendientes = pedidos.filter((pedido) => stages.get(pedido.id) === "paid");

  const publicados = productos.filter((p) => p.published && !p.archived).length;
  const ocultos = productos.filter((p) => !p.published && !p.archived).length;
  const archivados = productos.filter((p) => p.archived).length;

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-10">
      <section aria-labelledby="por-verificar">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 id="por-verificar" className="display text-3xl sm:text-4xl">
            Pagos pendientes: {porVerificar.length}
          </h1>
          <Link
            href="/admin/pedidos?estado=awaiting_verification"
            className="text-sm text-muted underline decoration-border underline-offset-4 hover:text-foreground"
          >
            Ver todos
          </Link>
        </div>

        {porVerificar.length === 0 ? (
          <p className="mt-4 border border-border bg-surface px-5 py-6 text-sm text-muted">
            No hay pagos esperando verificación.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {porVerificar.map((pedido) => (
              <li key={pedido.id} className="border border-accent/60 bg-accent/10 p-4">
                <p className="eyebrow text-accent-contrast">
                  Pedido {orderDisplayReference(pedido)}
                  <span className="px-1.5 text-border">·</span>
                  {relative(pedido.manualPayment?.reportedAt ?? null)}
                </p>
                <p className="mt-2 truncate text-lg font-semibold">{orderProductSummary(pedido)}</p>
                <p className="display mt-1 text-3xl">{formatMoney(pedido.total)}</p>
                <p className="mt-1 text-sm text-muted">
                  {pedido.manualPayment?.methodLabel ?? "Medio sin informar"}
                  {pedido.manualPayment?.proof !== null && pedido.manualPayment?.proof !== undefined
                    ? " · con comprobante"
                    : ""}
                </p>
                <Link
                  href={adminOrderPath(pedido)}
                  className="mt-4 flex min-h-12 w-full items-center justify-center bg-accent px-4 text-sm font-semibold uppercase tracking-wider text-accent-foreground hover:bg-accent-contrast"
                >
                  Ver
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {entregasPendientes.length > 0 ? (
        <section aria-labelledby="entregas" className="mt-8">
          <h2 id="entregas" className="eyebrow text-danger">
            Pagados con entrega pendiente: {entregasPendientes.length}
          </h2>
          <ul className="mt-3 space-y-2">
            {entregasPendientes.map((pedido) => (
              <li key={pedido.id}>
                <Link
                  href={adminOrderPath(pedido)}
                  className="flex items-center justify-between gap-3 border border-danger/50 bg-surface px-4 py-3 text-sm hover:border-danger"
                >
                  <span className="truncate">
                    {orderDisplayReference(pedido)} · {orderProductSummary(pedido)}
                  </span>
                  <span className="shrink-0 text-muted">{pedido.fulfillment.lastError ?? "Revisar"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <PushNotificationsPanel publicKey={push.publicKey} devices={dispositivos.length} />

        <section aria-labelledby="ped" className="border border-border bg-surface p-5">
          <h2 id="ped" className="eyebrow text-accent-contrast">
            Pedidos
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Dato etiqueta="Esperando pago" valor={count("pending") + count("awaiting_payment")} href="/admin/pedidos?estado=awaiting_payment" />
            <Dato etiqueta="Por verificar" valor={count("awaiting_verification")} href="/admin/pedidos?estado=awaiting_verification" />
            <Dato etiqueta="Pagados" valor={count("paid")} href="/admin/pedidos?estado=paid" />
            <Dato etiqueta="Completados" valor={count("completed")} href="/admin/pedidos?estado=completed" />
            <Dato etiqueta="Rechazados" valor={count("rejected")} href="/admin/pedidos?estado=rejected" />
            <Dato etiqueta="Totales" valor={pedidos.length} href="/admin/pedidos" />
          </div>
        </section>
      </div>

      <section aria-labelledby="prog" className="mt-8 border border-border bg-surface p-5">
        <h2 id="prog" className="eyebrow text-accent-contrast">
          Programas
        </h2>
        <div className="mt-4 grid grid-cols-3 gap-3">
          <Dato etiqueta="Publicados" valor={publicados} href="/admin/programas" />
          <Dato etiqueta="Ocultos" valor={ocultos} href="/admin/programas" />
          <Dato etiqueta="Archivados" valor={archivados} href="/admin/programas" />
        </div>
        {productos.length === 0 ? (
          <p className="mt-4 text-sm text-muted">
            Todavía no hay programas cargados.{" "}
            <Link href="/admin/programas/nuevo" className="text-accent-contrast underline">
              Creá el primero
            </Link>
            .
          </p>
        ) : null}
      </section>
    </main>
  );
}

function Dato({
  etiqueta,
  valor,
  href,
}: {
  readonly etiqueta: string;
  readonly valor: number;
  readonly href: string;
}) {
  return (
    <Link href={href} className="block border border-border bg-background px-4 py-3 transition-colors hover:border-accent/60">
      <p className="eyebrow">{etiqueta}</p>
      <p className="display mt-1 text-3xl">{valor}</p>
    </Link>
  );
}
