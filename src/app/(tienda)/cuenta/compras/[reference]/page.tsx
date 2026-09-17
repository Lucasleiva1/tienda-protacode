import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { OrderDetailView } from "@/components/purchases/OrderDetailView";
import { getCurrentCustomerAccount } from "@/features/accounts/customer-session";
import { orderDisplayReference } from "@/features/orders/order-display";
import { findOrder } from "@/features/orders/order-service";
import { isOrderOwnedBy } from "@/features/purchases/order-access";
import { getOrderPaymentContext } from "@/features/purchases/order-page-data";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: pick(locale, "Detalle de compra", "Purchase details", "Detalhes da compra"),
    robots: { index: false, follow: false, nocache: true },
  };
}

/**
 * Detalle de una compra de la cuenta.
 *
 * Aunque alguien cambie el número en la URL, el servidor compara el dueño del
 * pedido con la sesión y responde "no encontrado" si no coinciden (evita IDOR).
 */
export default async function MyPurchasePage({
  params,
}: PageProps<"/cuenta/compras/[reference]">) {
  const { reference } = await params;
  const locale = await getLocale();
  const account = await getCurrentCustomerAccount();
  if (account === null) {
    redirect(`/cuenta/iniciar-sesion?next=${encodeURIComponent(`/cuenta/compras/${reference}`)}`);
  }

  let candidate = reference;
  try {
    candidate = decodeURIComponent(reference);
  } catch {
    // Un valor mal codificado simplemente no encuentra pedido.
  }
  const order = await findOrder(candidate);
  if (order === null || !isOrderOwnedBy(order, account.id)) notFound();

  const { methods, whatsappUrl } = await getOrderPaymentContext(order);

  return (
    <OrderDetailView
      order={order}
      access={{ kind: "account", orderId: order.id }}
      locale={locale}
      breadcrumb={[
        { label: pick(locale, "Inicio", "Home", "Início"), href: "/" },
        { label: pick(locale, "Mis compras", "My purchases", "Minhas compras"), href: "/cuenta/compras" },
        { label: orderDisplayReference(order) },
      ]}
      methods={methods}
      whatsappUrl={whatsappUrl}
      privateLink={false}
    />
  );
}
