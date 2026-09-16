import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import type { Metadata } from "next";
import { ProductCatalog } from "@/components/products/ProductCatalog";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import {
  getPublishedProducts,
  getUsedCategories,
} from "@/features/products/queries";

/* Los productos los administra el Admin, así que la página se arma en cada visita. */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
  title: pick(locale, "Programas", "Programs", "Programas"),
  description:
    pick(locale, "Todos los programas de Prota Code. Herramientas de escritorio con pago único: comprás una vez y usás la versión adquirida de forma permanente.", "All Prota Code programs. Desktop tools with a one-time payment and permanent use of the version you buy.", "Todos os programas da Prota Code. Ferramentas para computador com pagamento único: você compra uma vez e usa a versão adquirida de forma permanente."),
  };
}

/**
 * Catálogo.
 *
 * La página es de servidor: lee los productos y arma el encabezado. Lo único que
 * viaja al navegador es el listado, porque la búsqueda tiene que responder mientras
 * se escribe.
 */
export default async function CatalogoPage() {
  const locale = await getLocale();
  const productos = await getPublishedProducts();
  const categorias = await getUsedCategories();

  return (
    <main>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
        <Breadcrumb
          items={[{ label: pick(locale, "Inicio", "Home", "Início"), href: "/" }, { label: pick(locale, "Programas", "Programs", "Programas") }]}
        />

        <header className="mt-10 border-b border-border pb-12">
          <div className="flex items-center gap-4">
            <span className="eyebrow shrink-0 text-accent-contrast">
              {pick(locale, "Software · Utilidades · Pago único", "Software · Utilities · One-time payment", "Software · Utilitários · Pagamento único")}
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>

          <h1 className="display mt-7 max-w-3xl text-5xl sm:text-6xl lg:text-7xl">
            {pick(locale, "Herramientas para problemas reales.", "Tools for real problems.", "Ferramentas para problemas reais.")}
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            {pick(locale, "Pagás una vez. Las usás. Cada programa resuelve algo concreto y la versión que comprás queda tuya de forma permanente.", "Pay once and use your tools. Each program solves a real problem, and the version you buy remains yours permanently.", "Você paga uma vez e usa. Cada programa resolve algo concreto, e a versão que você compra é sua de forma permanente.")}
          </p>
        </header>

        <div className="mt-10">
          {productos.length > 0 ? (
            <ProductCatalog products={productos} categories={categorias} locale={locale} />
          ) : (
            <div className="border border-border bg-surface px-6 py-20 text-center">
              <p className="display text-2xl">
                {pick(locale, "Todavía no hay programas publicados.", "No programs have been published yet.", "Ainda não há programas publicados.")}
              </p>
              <p className="mt-3 text-sm text-muted">
                {pick(locale, "Estamos preparando los primeros. Volvé en unos días.", "We are preparing the first ones. Check back in a few days.", "Estamos preparando os primeiros. Volte em alguns dias.")}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
