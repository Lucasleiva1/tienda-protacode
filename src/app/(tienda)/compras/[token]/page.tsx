import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OrderDetailView } from "@/components/purchases/OrderDetailView";
import { getOrderPaymentContext } from "@/features/purchases/order-page-data";
import { findOrderByPurchaseToken } from "@/features/purchases/purchase-access";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { allowRequest } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: pick(locale, "Tu compra", "Your purchase", "Sua compra"),
    robots: { index: false, follow: false, nocache: true },
  };
}

/**
 * Pedido por enlace privado.
 *
 * El token es la única llave: un número de pedido no alcanza para ver nada. Sirve
 * para compras como invitado y para los enlaces enviados por email.
 */
export default async function PurchasePage({ params }: PageProps<"/compras/[token]">) {
  const { token } = await params;
  const locale = await getLocale();
  if (!allowRequest("purchase-page", token, 30, 60_000)) notFound();
  const order = await findOrderByPurchaseToken(token);
  if (order === null) notFound();

  const { methods, whatsappUrl } = await getOrderPaymentContext(order);

  return (
    <OrderDetailView
      order={order}
      access={{ kind: "token", token }}
      locale={locale}
      breadcrumb={[
        { label: pick(locale, "Inicio", "Home", "Início"), href: "/" },
        { label: pick(locale, "Tu compra", "Your purchase", "Sua compra") },
      ]}
      methods={methods}
      whatsappUrl={whatsappUrl}
      privateLink
    />
  );
}
