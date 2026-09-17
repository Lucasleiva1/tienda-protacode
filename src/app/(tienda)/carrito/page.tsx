import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { siteConfig } from "@/config/site";
import { getPublishedProducts } from "@/features/products/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
  title: pick(locale, "Tu carrito", "Your cart", "Seu carrinho"),
  description:
    pick(locale, "Los programas que elegiste. Pago único, sin suscripciones y licencia de uso permanente para la versión adquirida.", "The programs you chose. One-time payment, no subscriptions, and permanent use of the version you buy.", "Os programas que você escolheu. Pagamento único, sem assinaturas e licença de uso permanente para a versão adquirida."),
  robots: { index: false },
  };
}

/**
 * Carrito.
 *
 * La página es de servidor y su trabajo es uno solo: leer el catálogo actual y
 * pasárselo a la vista. El carrito guardado en el navegador tiene únicamente
 * identificadores, así que el precio y el nombre que se muestran salen siempre de
 * este catálogo y no de una copia vieja.
 *
 * El día que los productos vengan de una base de datos, cambia esta consulta y nada
 * más: el navegador nunca guardó productos.
 */
export default async function CarritoPage() {
  const locale = await getLocale();
  const catalogo = await getPublishedProducts();

  return (
    <main>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
        <Breadcrumb
          items={[{ label: pick(locale, "Inicio", "Home", "Início"), href: "/" }, { label: pick(locale, "Carrito", "Cart", "Carrinho") }]}
        />

        <header className="mt-10 border-b border-border pb-10">
          <div className="flex items-center gap-4">
            <span className="eyebrow shrink-0 text-accent-contrast">
              {pick(locale, "Pago único · Sin suscripciones", "One-time payment · No subscriptions", "Pagamento único · Sem assinaturas")}
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>

          <h1 className="display mt-6 text-5xl sm:text-6xl">{pick(locale, "Tu carrito", "Your cart", "Seu carrinho")}</h1>
        </header>

        <div className="mt-10">
          <CartView
            catalog={catalogo}
            locale={locale}
            currency={siteConfig.defaultCurrency}
          />
        </div>
      </div>
    </main>
  );
}
