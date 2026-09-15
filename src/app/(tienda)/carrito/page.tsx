import type { Metadata } from "next";
import { CartView } from "@/components/cart/CartView";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { siteConfig } from "@/config/site";
import { getPublishedProducts } from "@/features/products/queries";
import { getWhatsAppConfiguration } from "@/features/checkout/whatsapp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tu carrito",
  description:
    "Los programas que elegiste. Pago único, sin suscripciones y licencia de uso permanente para la versión adquirida.",
  robots: { index: false },
};

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
  const catalogo = await getPublishedProducts();
  const whatsapp = await getWhatsAppConfiguration();

  return (
    <main>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
        <Breadcrumb
          items={[{ label: "Inicio", href: "/" }, { label: "Carrito" }]}
        />

        <header className="mt-10 border-b border-border pb-10">
          <div className="flex items-center gap-4">
            <span className="eyebrow shrink-0 text-accent-contrast">
              Pago único · Sin suscripciones
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>

          <h1 className="display mt-6 text-5xl sm:text-6xl">Tu carrito</h1>
        </header>

        <div className="mt-10">
          <CartView
            catalog={catalogo}
            currency={siteConfig.defaultCurrency}
            whatsappRequested={whatsapp.requested}
            whatsappEnabled={whatsapp.ready}
          />
        </div>
      </div>
    </main>
  );
}
