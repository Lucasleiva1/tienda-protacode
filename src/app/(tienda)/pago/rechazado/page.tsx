import type { Metadata } from "next";
import { ClearPurchasedCart } from "@/components/payments/ClearPurchasedCart";
import { PaymentStatusCard } from "@/components/payments/PaymentStatusCard";
import { findOrder } from "@/features/orders/order-service";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(locale, "Pago rechazado", "Payment declined", "Pagamento recusado"), robots: { index: false } };
}

export default async function PagoRechazadoPage({
  searchParams,
}: PageProps<"/pago/rechazado">) {
  const locale = await getLocale();
  const params = await searchParams;
  const id = typeof params.pedido === "string" ? params.pedido : null;
  const order = id === null ? null : await findOrder(id);

  if (order?.status === "paid" || order?.status === "fulfilled") {
    return (
      <>
        <PaymentStatusCard
          locale={locale}
          eyebrow={pick(locale, "Pago confirmado", "Payment confirmed", "Pagamento confirmado")}
          title={pick(locale, "PAGO CONFIRMADO", "PAYMENT CONFIRMED", "PAGAMENTO CONFIRMADO")}
          message={pick(locale, "Aunque llegaste por una dirección de rechazo, el estado persistido confirma que el pedido está pagado.", "Even though you arrived through a declined-payment address, the saved status confirms the order is paid.", "Embora você tenha chegado por um endereço de recusa, o status registrado confirma que o pedido está pago.")}
          order={order}
          secondaryHref="/"
          secondaryLabel={pick(locale, "Volver al inicio", "Back to home", "Voltar ao início")}
        />
        <ClearPurchasedCart slugs={order.items.map((item) => item.slug)} />
      </>
    );
  }

  return (
    <PaymentStatusCard
      locale={locale}
      eyebrow={pick(locale, "Estado del pago", "Payment status", "Status do pagamento")}
      title={pick(locale, "PAGO RECHAZADO", "PAYMENT DECLINED", "PAGAMENTO RECUSADO")}
      message={pick(locale, "El pedido no figura como pagado. No se generó ninguna licencia y tu carrito sigue intacto para que puedas volver cuando exista un medio de pago disponible.", "The order is not marked as paid. No license was generated, and your cart is still intact so you can come back when a payment method is available.", "O pedido não consta como pago. Nenhuma licença foi gerada, e seu carrinho continua intacto para você voltar quando houver um meio de pagamento disponível.")}
      order={order}
    />
  );
}
