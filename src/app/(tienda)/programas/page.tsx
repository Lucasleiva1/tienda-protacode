import type { Metadata } from "next";
import { ProductCatalog } from "@/components/products/ProductCatalog";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import {
  getPublishedProducts,
  getUsedCategories,
} from "@/features/products/queries";

/* Los productos los administra el Admin, así que la página se arma en cada visita. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Programas",
  description:
    "Todos los programas de Prota Code. Herramientas de escritorio con pago único: comprás una vez y usás la versión adquirida de forma permanente.",
};

/**
 * Catálogo.
 *
 * La página es de servidor: lee los productos y arma el encabezado. Lo único que
 * viaja al navegador es el listado, porque la búsqueda tiene que responder mientras
 * se escribe.
 */
export default async function CatalogoPage() {
  const productos = await getPublishedProducts();
  const categorias = await getUsedCategories();

  return (
    <main>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
        <Breadcrumb
          items={[{ label: "Inicio", href: "/" }, { label: "Programas" }]}
        />

        <header className="mt-10 border-b border-border pb-12">
          <div className="flex items-center gap-4">
            <span className="eyebrow shrink-0 text-accent-contrast">
              Software · Utilidades · Pago único
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>

          <h1 className="display mt-7 max-w-3xl text-5xl sm:text-6xl lg:text-7xl">
            Herramientas para problemas reales.
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            Pagás una vez. Las usás. Cada programa resuelve algo concreto y la versión
            que comprás queda tuya de forma permanente.
          </p>
        </header>

        <div className="mt-10">
          {productos.length > 0 ? (
            <ProductCatalog products={productos} categories={categorias} />
          ) : (
            <div className="border border-border bg-surface px-6 py-20 text-center">
              <p className="display text-2xl">
                Todavía no hay programas publicados.
              </p>
              <p className="mt-3 text-sm text-muted">
                Estamos preparando los primeros. Volvé en unos días.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
