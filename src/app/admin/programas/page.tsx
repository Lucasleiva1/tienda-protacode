import Image from "next/image";
import Link from "next/link";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { requireAdminPage } from "@/features/admin/guard";
import { categoryLabel, platformsLabel } from "@/features/products/format";
import { getProducts } from "@/features/products/queries";
import { formatMoney } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

export const metadata = { title: "Programas" };

/**
 * Listado de programas.
 *
 * Muestra TODOS: publicados, ocultos y archivados. El Admin tiene que poder ver lo
 * que el público no ve; si un programa oculto desapareciera de acá, no habría manera
 * de volver a publicarlo.
 *
 * No es una tabla: en una pantalla de 1024 una tabla con doce columnas obliga a
 * desplazarse de costado. Cada programa es una ficha que se reacomoda sola.
 */
export default async function AdminProgramasPage() {
  await requireAdminPage();
  const productos = await getProducts();

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-4xl">Programas</h1>
          <p className="mt-2 text-sm text-muted">
            {productos.length === 1
              ? "1 programa cargado"
              : `${productos.length} programas cargados`}
          </p>
        </div>

        <Link
          href="/admin/programas/nuevo"
          className="bg-accent px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast"
        >
          Nuevo programa
        </Link>
      </div>

      {productos.length === 0 ? (
        <p className="mt-10 border border-border bg-surface px-6 py-14 text-center text-sm text-muted">
          Todavía no hay programas. Creá el primero con el botón de arriba.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {productos.map((producto) => (
            <li
              key={producto.id}
              className={`border bg-surface p-4 ${
                producto.archived ? "border-border/50 opacity-60" : "border-border"
              }`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                <div className="flex min-w-0 flex-1 gap-4">
                  {producto.heroImage !== null ? (
                    <Image
                      src={producto.heroImage.src}
                      alt=""
                      width={120}
                      height={80}
                      sizes="80px"
                      className="h-14 w-20 shrink-0 border border-border object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-14 w-20 shrink-0 items-center justify-center border border-dashed border-border text-[0.6rem] uppercase tracking-wider text-muted"
                    >
                      sin foto
                    </span>
                  )}

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="display text-xl">{producto.name}</h2>
                      <Estado
                        published={producto.published}
                        archived={producto.archived}
                      />
                    </div>

                    <p className="eyebrow mt-1.5">
                      {categoryLabel(producto.category)}
                      <Sep />
                      {platformsLabel(producto.platforms)}
                      <Sep />v{producto.version}
                      <Sep />
                      orden {producto.sortOrder}
                    </p>

                    <p className="eyebrow mt-1 text-muted/70">
                      /{producto.slug}
                      <Sep />
                      appId: {producto.appId}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 lg:w-32 lg:text-right">
                  <p className="font-semibold">
                    {formatMoney(producto.price[producto.currency])}
                  </p>
                  <p className="eyebrow mt-0.5">{producto.currency}</p>
                </div>

                <div className="shrink-0 space-y-2 lg:w-[22rem]">
                  <ProductRowActions
                    id={producto.id}
                    nombre={producto.name}
                    published={producto.published}
                    featured={producto.featured}
                    archived={producto.archived}
                  />

                  <div className="flex flex-wrap gap-1.5">
                    <Link
                      href={`/admin/programas/${producto.id}`}
                      className="border border-border px-2.5 py-1 text-xs uppercase tracking-wider text-foreground transition-colors hover:border-accent"
                    >
                      Editar
                    </Link>
                    {producto.published && !producto.archived ? (
                      <Link
                        href={`/programas/${producto.slug}`}
                        className="border border-border px-2.5 py-1 text-xs uppercase tracking-wider text-muted transition-colors hover:text-foreground"
                      >
                        Ver en tienda
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Sep() {
  return <span className="px-1.5 text-border">·</span>;
}

function Estado({
  published,
  archived,
}: {
  readonly published: boolean;
  readonly archived: boolean;
}) {
  if (archived) {
    return (
      <span className="eyebrow border border-border px-2 py-0.5">Archivado</span>
    );
  }
  return published ? (
    <span className="eyebrow border border-accent/50 px-2 py-0.5 text-accent-contrast">
      Publicado
    </span>
  ) : (
    <span className="eyebrow border border-border px-2 py-0.5">Oculto</span>
  );
}
