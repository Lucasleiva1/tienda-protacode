import Link from "next/link";
import { requireAdminPage } from "@/features/admin/guard";
import { findAllOrders } from "@/features/orders/persistent-order-repository";
import { getProducts } from "@/features/products/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Resumen" };

export default async function AdminInicioPage() {
  await requireAdminPage();

  const [productos, pedidos] = await Promise.all([getProducts(), findAllOrders()]);

  const publicados = productos.filter((p) => p.published && !p.archived).length;
  const ocultos = productos.filter((p) => !p.published && !p.archived).length;
  const archivados = productos.filter((p) => p.archived).length;

  const porEstado = (estado: string) =>
    pedidos.filter((p) => p.status === estado).length;

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-10 sm:px-6">
      <h1 className="display text-4xl">Resumen</h1>

      <section aria-labelledby="prog" className="mt-10">
        <h2 id="prog" className="eyebrow text-accent-contrast">
          Programas
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Dato etiqueta="Publicados" valor={publicados} />
          <Dato etiqueta="Ocultos" valor={ocultos} />
          <Dato etiqueta="Archivados" valor={archivados} />
        </div>
        <Link
          href="/admin/programas"
          className="mt-4 inline-block text-sm text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-accent"
        >
          Administrar programas
        </Link>
      </section>

      <section aria-labelledby="ped" className="mt-12">
        <h2 id="ped" className="eyebrow text-accent-contrast">
          Pedidos
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Dato etiqueta="Totales" valor={pedidos.length} />
          <Dato etiqueta="Pendientes" valor={porEstado("pending")} />
          <Dato etiqueta="Pagados" valor={porEstado("paid")} />
          <Dato etiqueta="Fallidos" valor={porEstado("failed")} />
          <Dato etiqueta="Cancelados" valor={porEstado("cancelled")} />
        </div>
        <Link
          href="/admin/pedidos"
          className="mt-4 inline-block text-sm text-foreground underline decoration-border underline-offset-4 transition-colors hover:decoration-accent"
        >
          Ver pedidos
        </Link>
      </section>

      {productos.length === 0 ? (
        <p className="mt-12 border border-border bg-surface px-5 py-4 text-sm text-muted">
          Todavía no hay programas cargados.{" "}
          <Link href="/admin/programas/nuevo" className="text-accent-contrast underline">
            Creá el primero
          </Link>
          .
        </p>
      ) : null}
    </main>
  );
}

function Dato({ etiqueta, valor }: { readonly etiqueta: string; readonly valor: number }) {
  return (
    <div className="border border-border bg-surface px-5 py-4">
      <p className="eyebrow">{etiqueta}</p>
      <p className="display mt-2 text-4xl">{valor}</p>
    </div>
  );
}
