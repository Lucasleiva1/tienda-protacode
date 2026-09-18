import Link from "next/link";
import { PushNotificationsPanel } from "@/components/admin/PushNotificationsPanel";
import { requireAdminPage } from "@/features/admin/guard";
import { getVisitSummary, type VisitSummary } from "@/features/analytics/visits";
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
  const [productos, pedidos, dispositivos, visitas] = await Promise.all([
    getProducts(),
    findAllOrders(),
    push.ready ? getPushSubscriptionRepository().list() : Promise.resolve([]),
    getVisitSummary(),
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

      <Visitas resumen={visitas} />

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

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** Visitas a la tienda: una por persona y por día. Sin datos personales. */
function Visitas({ resumen }: { readonly resumen: VisitSummary }) {
  const maxDia = Math.max(1, ...resumen.dias.map((d) => d.visitas));
  const maxMes = Math.max(1, ...resumen.meses.map((m) => m.visitas));

  return (
    <section aria-labelledby="visitas" className="mt-8 border border-border bg-surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="visitas" className="eyebrow text-accent-contrast">
          Visitas a la tienda
        </h2>
        <p className="text-xs text-muted">Cada persona cuenta una vez por día. Tus visitas con el panel abierto no suman.</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cifra etiqueta="Hoy" valor={resumen.hoy} />
        <Cifra etiqueta="Ayer" valor={resumen.ayer} />
        <Cifra etiqueta="Este mes" valor={resumen.mes} />
        <Cifra etiqueta="Este año" valor={resumen.anio} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <p className="eyebrow">Últimos 14 días</p>
          <ol className="mt-3 flex h-36 items-end gap-1">
            {resumen.dias.map(({ dia, visitas }) => {
              const fecha = new Date(`${dia}T12:00:00Z`);
              return (
                <li key={dia} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[10px] text-muted">{visitas}</span>
                  <span
                    className="w-full bg-accent/70"
                    style={{ height: `${Math.max(2, (visitas / maxDia) * 100)}%` }}
                    title={`${dia}: ${visitas} visitas`}
                  />
                  <span className="text-[10px] leading-tight text-muted">
                    {DIAS_SEMANA[fecha.getUTCDay()]}
                    <br />
                    {fecha.getUTCDate()}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div>
          <p className="eyebrow">Por mes ({resumen.meses[0]?.mes.slice(0, 4) ?? ""})</p>
          <ul className="mt-3 space-y-1.5">
            {resumen.meses.map(({ mes, visitas }) => (
              <li key={mes} className="flex items-center gap-3 text-sm">
                <span className="w-9 shrink-0 text-muted">{MESES[Number(mes.slice(5, 7)) - 1]}</span>
                <span className="h-3 flex-1 bg-background">
                  <span className="block h-full bg-accent/70" style={{ width: `${(visitas / maxMes) * 100}%` }} />
                </span>
                <span className="w-12 shrink-0 text-right font-semibold">{visitas}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Cifra({ etiqueta, valor }: { readonly etiqueta: string; readonly valor: number }) {
  return (
    <div className="border border-border bg-background px-4 py-3">
      <p className="eyebrow">{etiqueta}</p>
      <p className="display mt-1 text-3xl">{valor.toLocaleString("es-AR")}</p>
    </div>
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
