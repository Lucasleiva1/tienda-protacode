import Link from "next/link";
import { requireAdminPage } from "@/features/admin/guard";
import { ADMIN_STAGE_LABEL } from "@/features/admin/order-labels";
import {
  adminOrderPath,
  orderDisplayReference,
  orderProductSummary,
} from "@/features/orders/order-display";
import { findAllOrders } from "@/features/orders/persistent-order-repository";
import { getOrderStage, type OrderStage } from "@/features/payments/manual-payment-state";
import { formatMoney } from "@/lib/utils/money";
import type { Order } from "@/types/order";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos" };

type Filtro = "todos" | "awaiting_payment" | "awaiting_verification" | "paid" | "rejected" | "completed";

const FILTROS: readonly { readonly valor: Filtro; readonly label: string }[] = [
  { valor: "todos", label: "Todos" },
  { valor: "awaiting_payment", label: "Esperando pago" },
  { valor: "awaiting_verification", label: "Esperando verificación" },
  { valor: "paid", label: "Pagados" },
  { valor: "rejected", label: "Rechazados" },
  { valor: "completed", label: "Completados" },
];

function matches(filtro: Filtro, stage: OrderStage): boolean {
  if (filtro === "todos") return true;
  if (filtro === "awaiting_payment") return stage === "pending" || stage === "awaiting_payment";
  return stage === filtro;
}

function metodo(order: Order): string {
  if (order.payment.provider === "free") return "Gratis";
  return order.manualPayment?.methodLabel ?? (order.payment.provider ?? "—");
}

/**
 * Listado de pedidos.
 *
 * La búsqueda y el filtro viajan en la dirección web (`?q=` y `?estado=`) y se
 * resuelven en el servidor. Así no hace falta mandar todos los pedidos —con los
 * emails de los clientes adentro— al navegador solo para poder filtrarlos.
 */
export default async function AdminPedidosPage({
  searchParams,
}: PageProps<"/admin/pedidos">) {
  await requireAdminPage();

  const params = await searchParams;
  const consulta = (typeof params.q === "string" ? params.q : "").trim().toLowerCase().slice(0, 100);
  const pedido = typeof params.estado === "string" ? params.estado : "todos";
  const filtro: Filtro = FILTROS.some((item) => item.valor === pedido) ? (pedido as Filtro) : "todos";

  const todos = await findAllOrders();
  const conEtapa = todos.map((order) => ({ order, stage: getOrderStage(order) }));

  const pedidos = conEtapa
    .filter(({ stage }) => matches(filtro, stage))
    .filter(({ order }) => {
      if (consulta === "") return true;
      const campos = [
        order.id,
        order.reference ?? "",
        order.customer.email,
        order.customer.firstName,
        order.customer.lastName,
        order.customer.whatsapp ?? "",
        ...order.items.map((item) => item.name),
      ]
        .join(" ")
        .toLowerCase();
      return campos.includes(consulta);
    })
    // Los que esperan verificación van primero.
    .sort((a, b) => Number(b.stage === "awaiting_verification") - Number(a.stage === "awaiting_verification"));

  const cantidad = (valor: Filtro) => conEtapa.filter(({ stage }) => matches(valor, stage)).length;

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl">Pedidos</h1>
          <p className="mt-2 text-sm text-muted">
            {pedidos.length} de {todos.length}
          </p>
        </div>

        <Link
          href="/api/admin/backup/pedidos"
          className="border border-border px-4 py-2.5 text-xs uppercase tracking-wider text-muted transition-colors hover:border-accent hover:text-foreground"
        >
          Exportar JSON
        </Link>
      </div>

      <nav aria-label="Filtrar por estado" className="-mx-4 mt-6 overflow-x-auto px-4">
        <ul className="flex gap-2">
          {FILTROS.map((item) => {
            const activo = item.valor === filtro;
            const query = new URLSearchParams();
            if (item.valor !== "todos") query.set("estado", item.valor);
            if (consulta !== "") query.set("q", consulta);
            const search = query.toString();
            const href = search === "" ? "/admin/pedidos" : `/admin/pedidos?${search}`;
            return (
              <li key={item.valor}>
                <Link
                  href={href}
                  aria-current={activo ? "page" : undefined}
                  className={`flex min-h-10 items-center gap-2 whitespace-nowrap border px-3 py-2 text-xs font-semibold uppercase tracking-wider ${
                    activo
                      ? "border-accent bg-accent text-accent-foreground"
                      : item.valor === "awaiting_verification" && cantidad(item.valor) > 0
                        ? "border-accent/70 text-foreground"
                        : "border-border text-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                  <span className={activo ? "" : "text-accent-contrast"}>{cantidad(item.valor)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <form className="mt-4 flex flex-wrap items-end gap-3 border-y border-border py-4">
        {filtro !== "todos" ? <input type="hidden" name="estado" value={filtro} /> : null}
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="q" className="eyebrow">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={consulta}
            placeholder="PC-1051, email, nombre o programa"
            className="mt-1.5 w-full border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="min-h-10 border border-accent bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wider text-accent-foreground"
        >
          Buscar
        </button>
      </form>

      {pedidos.length === 0 ? (
        <p className="mt-10 border border-border bg-surface px-6 py-14 text-center text-sm text-muted">
          {todos.length === 0 ? "Todavía no hay pedidos." : "Ningún pedido coincide con ese filtro."}
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {pedidos.map(({ order, stage }) => {
            const destacar = stage === "awaiting_verification";
            return (
              <li key={order.id}>
                <Link
                  href={adminOrderPath(order)}
                  className={`grid gap-3 border p-4 transition-colors sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center ${
                    destacar
                      ? "border-accent/70 bg-accent/10 hover:border-accent"
                      : "border-border bg-surface hover:border-accent/50"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="eyebrow text-accent-contrast">
                      {orderDisplayReference(order)}
                      <span className="px-1.5 text-border">·</span>
                      {new Date(order.createdAt).toLocaleString("es-AR", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "America/Argentina/Buenos_Aires",
                      })}
                    </p>
                    <p className="mt-1 truncate font-semibold">{orderProductSummary(order)}</p>
                    <p className="truncate text-sm text-muted">
                      {order.customer.firstName} {order.customer.lastName} · {order.customer.email}
                    </p>
                  </div>

                  <div className="text-sm">
                    <p className="text-muted">{metodo(order)}</p>
                    <p className={`eyebrow mt-1 ${destacar ? "text-accent-contrast" : stage === "paid" ? "text-danger" : "text-foreground"}`}>
                      {ADMIN_STAGE_LABEL[stage]}
                    </p>
                  </div>

                  <p className="display text-2xl sm:text-right">{formatMoney(order.total)}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
