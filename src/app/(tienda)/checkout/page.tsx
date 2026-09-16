import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";
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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
  title: pick(locale, "Finalizar compra", "Checkout", "Finalizar compra"),
  description: pick(locale, "Completá tus datos para preparar el pedido.", "Confirm your details to prepare your order.", "Confirme seus dados para preparar o pedido."),
  robots: { index: false },
  };
}

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
  const locale = await getLocale();
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
            { label: pick(locale, "Inicio", "Home", "Início"), href: "/" },
            { label: pick(locale, "Carrito", "Cart", "Carrinho"), href: "/carrito" },
            { label: pick(locale, "Finalizar compra", "Checkout", "Finalizar compra") },
          ]}
        />

        <header className="mt-10 border-b border-border pb-10">
          <div className="flex items-center gap-4">
            <span className="eyebrow shrink-0 text-accent-contrast">
              {pick(locale, "Pago único · Sin suscripciones", "One-time payment · No subscriptions", "Pagamento único · Sem assinaturas")}
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-border" />
          </div>

          <h1 className="display mt-6 text-5xl sm:text-6xl">{pick(locale, "Finalizar compra", "Checkout", "Finalizar compra")}</h1>
        </header>

        <div className="mt-10">
          <CheckoutView
            catalog={catalogo}
            locale={locale}
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
