import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { CheckoutView } from "@/components/checkout/CheckoutView";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { siteConfig } from "@/config/site";
import { getCurrentCustomerProfile } from "@/features/accounts/customer-session";
import { googleRedirectSignInHref } from "@/features/accounts/google-auth";
import { getGoogleClientId } from "@/features/accounts/google-identity";
import { getProductBySlug } from "@/features/products/queries";
import { localizeProduct } from "@/i18n/product-copy";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { getPaymentConfiguration } from "@/lib/payments/gateway-registry";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: pick(locale, "Comprar", "Buy", "Comprar"),
    robots: { index: false },
  };
}

/**
 * Compra directa desde la ficha ("Comprar").
 *
 * Mismo checkout que el carrito, pero con un solo programa y sin tocar el carrito.
 * Del navegador solo viaja el slug: el precio lo resuelve el servidor.
 */
export default async function BuyNowPage({ params }: PageProps<"/comprar/[slug]">) {
  const { slug } = await params;
  const locale = await getLocale();
  const product = await getProductBySlug(slug);
  if (product === undefined) notFound();
  if (product.pricingType === "free") redirect(`/programas/${encodeURIComponent(product.slug)}`);

  const customer = await getCurrentCustomerProfile();
  const payment = getPaymentConfiguration();
  const localized = localizeProduct(product, locale);
  const returnPath = `/comprar/${encodeURIComponent(product.slug)}`;

  return (
    <main>
      <div className="mx-auto w-full max-w-[1400px] px-4 py-10 sm:px-6 lg:px-10 lg:py-16">
        <Breadcrumb
          locale={locale}
          items={[
            { label: pick(locale, "Inicio", "Home", "Início"), href: "/" },
            { label: localized.name, href: `/programas/${encodeURIComponent(product.slug)}` },
            { label: pick(locale, "Comprar", "Buy", "Comprar") },
          ]}
        />

        <header className="mt-8 border-b border-border pb-8">
          <p className="eyebrow text-accent-contrast">
            {pick(locale, "Pago único · Sin suscripciones", "One-time payment · No subscriptions", "Pagamento único · Sem assinaturas")}
          </p>
          <h1 className="display mt-4 text-4xl sm:text-6xl">
            {pick(locale, "Comprar ", "Buy ", "Comprar ")}
            {localized.name}
          </h1>
        </header>

        <div className="mt-8">
          <CheckoutView
            catalog={[product]}
            directProducts={[product]}
            locale={locale}
            currency={siteConfig.defaultCurrency}
            customer={customer}
            paymentMode={payment.ready ? "gateway" : "manual"}
            googleReady={getGoogleClientId() !== null}
            googleFallbackHref={googleRedirectSignInHref(returnPath)}
            returnPath={returnPath}
            backHref={`/programas/${encodeURIComponent(product.slug)}`}
            backLabel={pick(locale, "Volver al programa", "Back to the program", "Voltar ao programa")}
          />
        </div>
      </div>
    </main>
  );
}
