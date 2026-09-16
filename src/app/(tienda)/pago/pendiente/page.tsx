import type { Metadata } from "next";
import { ClearPurchasedCart } from "@/components/payments/ClearPurchasedCart";
import { PaymentStatusCard } from "@/components/payments/PaymentStatusCard";
import { findOrder } from "@/features/orders/order-service";
import { getPaymentConfiguration } from "@/lib/payments/gateway-registry";
import { purchaseHrefFromCookie } from "@/features/purchases/purchase-cookie";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(locale, "Pago pendiente", "Payment pending", "Pagamento pendente"), robots: { index: false } };
}

export default async function PagoPendientePage({
  searchParams,
}: PageProps<"/pago/pendiente">) {
  const locale = await getLocale();
  const params = await searchParams;
  const id = typeof params.pedido === "string" ? params.pedido : null;
  const order = id === null ? null : await findOrder(id);

  if (order?.status === "paid" || order?.status === "fulfilled") {
    const purchaseHref = await purchaseHrefFromCookie(order);
    return (
      <>
        <PaymentStatusCard
          locale={locale}
          eyebrow={pick(locale, "Pago confirmado", "Payment confirmed", "Pagamento confirmado")}
          title={pick(locale, "PAGO CONFIRMADO", "PAYMENT CONFIRMED", "PAGAMENTO CONFIRMADO")}
          message={pick(locale, "El pago ya fue confirmado por el servidor. La entrega se prepara de forma segura y no necesitás volver a pagar.", "The payment was already confirmed by the server. Delivery is being prepared securely and you do not need to pay again.", "O pagamento já foi confirmado pelo servidor. A entrega está sendo preparada com segurança e você não precisa pagar de novo.")}
          order={order}
          secondaryHref={purchaseHref ?? "/"}
          secondaryLabel={purchaseHref === null ? pick(locale, "Volver al inicio", "Back to home", "Voltar ao início") : pick(locale, "Ver mi compra", "View my purchase", "Ver minha compra")}
        />
        <ClearPurchasedCart slugs={order.items.map((item) => item.slug)} />
      </>
    );
  }

  const config = getPaymentConfiguration();
  const message = config.ready
    ? pick(locale, "Estamos esperando la confirmación segura del medio de pago. Tu carrito se mantiene intacto mientras el pedido no figure como pagado.", "We are waiting for secure confirmation from the payment method. Your cart stays intact while the order is not marked as paid.", "Estamos aguardando a confirmação segura do meio de pagamento. Seu carrinho continua intacto enquanto o pedido não constar como pago.")
    : pick(locale, "El medio de pago todavía no está configurado. No se te cobró nada; el pedido queda guardado como pendiente y tu carrito se mantiene intacto.", "The payment method is not configured yet. You were not charged; the order is saved as pending and your cart stays intact.", "O meio de pagamento ainda não está configurado. Nada foi cobrado; o pedido fica salvo como pendente e seu carrinho continua intacto.");

  return (
    <PaymentStatusCard
      locale={locale}
      eyebrow={pick(locale, "Estado del pago", "Payment status", "Status do pagamento")}
      title={pick(locale, "PAGO PENDIENTE", "PAYMENT PENDING", "PAGAMENTO PENDENTE")}
      message={message}
      order={order}
    />
  );
}
