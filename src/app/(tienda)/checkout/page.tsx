import type { Metadata } from "next";
import { CheckoutView } from "@/components/checkout/CheckoutView";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { siteConfig } from "@/config/site";
import { getPaymentConfiguration } from "@/lib/payments/gateway-registry";
import { getPublishedProducts } from "@/features/products/queries";
import { getWhatsAppConfiguration } from "@/features/checkout/whatsapp";
import { getCurrentCustomerProfile } from "@/features/accounts/customer-session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Finalizar compra",
  description: "Completá tus datos para preparar el pedido.",
  robots: { index: false },
};

/**
 * Checkout.
 *
 * La página es de servidor y solo lee el catálogo. Lo interactivo (el formulario y
 * la lectura del carrito) vive en `CheckoutView`.
 *
 * Los importes que se muestran acá son informativos: el precio que vale es el que
 * recalcula el servidor al crear el pedido.
 */
export default async function CheckoutPage() {
  const customer = await getCurrentCustomerProfile();
  if (customer === null) redirect("/cuenta/iniciar-sesion?next=/checkout");
  if (!customer.emailVerified) redirect("/cuenta?verificacion=requerida&next=/checkout");

  const catalogo = await getPublishedProducts();
  const payment = getPaymentConfiguration();
  const whatsapp = await getWhatsAppConfiguration();

  return (
    <main>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-14 sm:px-6 lg:px-10 lg:py-20">
        <Breadcrumb
          items={[
            { label: "Inicio", href: "/" },
            { label: "Carrito", href: "/carrito" },
            { label: "Finalizar compra" },
          ]}
        />

        <header className="mt-10 border-b border-border pb-10">
          <div className="flex items-center gap-4">
            <span className="eyebrow shrink-0 text-accent-contrast">
              Pago único · Sin suscripciones
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>

          <h1 className="display mt-6 text-5xl sm:text-6xl">Finalizar compra</h1>
        </header>

        <div className="mt-10">
          <CheckoutView
            catalog={catalogo}
            currency={siteConfig.defaultCurrency}
            paymentEnabled={payment.ready}
            whatsappRequested={whatsapp.requested}
            whatsappEnabled={whatsapp.ready}
            customer={customer}
          />
        </div>
      </div>
    </main>
  );
}
