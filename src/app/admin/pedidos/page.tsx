import Link from "next/link";
import { requireAdminPage } from "@/features/admin/guard";
import { findAllOrders } from "@/features/orders/persistent-order-repository";
import { formatMoney } from "@/lib/utils/money";
import type { OrderStatus } from "@/types/order";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos" };

const ESTADOS: readonly (OrderStatus | "todos")[] = [
  "todos",
  "pending",
  "paid",
  "failed",
  "cancelled",
  "fulfilled",
];

const ESTADO_LABEL: Record<string, string> = {
  todos: "Todos",
  pending: "Pendientes",
  paid: "Pagados",
  failed: "Fallidos",
  cancelled: "Cancelados",
  fulfilled: "Entregados",
};

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
  const consulta = (typeof params.q === "string" ? params.q : "").trim().toLowerCase();
  const estado = typeof params.estado === "string" ? params.estado : "todos";

  const todos = await findAllOrders();

  const pedidos = todos
    .filter((pedido) => estado === "todos" || pedido.status === estado)
    .filter((pedido) => {
      if (consulta === "") return true;
      const campos = [
        pedido.id,
        pedido.customer.email,
        pedido.customer.firstName,
        pedido.customer.lastName,
      ]
        .join(" ")
        .toLowerCase();
      return campos.includes(consulta);
    });

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-10 sm:px-6">
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

      <form className="mt-8 flex flex-wrap items-end gap-4 border-y border-border py-5">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="q" className="eyebrow">
            Buscar
          </label>
          <input
            id="q"
            name="q"
            type="search"
            defaultValue={consulta}
            placeholder="Número de pedido, email o nombre"
            className="mt-1.5 w-full border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="estado" className="eyebrow">
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            defaultValue={estado}
            className="mt-1.5 border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          >
            {ESTADOS.map((valor) => (
              <option key={valor} value={valor}>
                {ESTADO_LABEL[valor]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          className="border border-accent bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wider text-accent-foreground"
        >
          Filtrar
        </button>
      </form>

      {pedidos.length === 0 ? (
        <p className="mt-10 border border-border bg-surface px-6 py-14 text-center text-sm text-muted">
          {todos.length === 0
            ? "Todavía no hay pedidos."
            : "Ningún pedido coincide con esa búsqueda."}
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {pedidos.map((pedido) => (
            <li key={pedido.id}>
              <Link
                href={`/admin/pedidos/${pedido.id}`}
                className="flex flex-col gap-3 border border-border bg-surface p-4 transition-colors hover:border-accent/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="eyebrow text-accent-contrast">
                    {pedido.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="mt-1 truncate font-semibold">
                    {pedido.customer.firstName} {pedido.customer.lastName}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {pedido.customer.email}
                  </p>
                </div>

                <div className="shrink-0 sm:text-right">
                  <p className="font-semibold">{formatMoney(pedido.total)}</p>
                  <p className="eyebrow mt-1">
                    {new Date(pedido.createdAt).toLocaleDateString("es-AR")}
                    <span className="px-1.5 text-border">·</span>
                    {pedido.items.length} prog.
                  </p>
                  <p className="eyebrow mt-1 text-foreground">
                    {ESTADO_LABEL[pedido.status] ?? pedido.status}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
