import type { Metadata } from "next";
import { ClearPurchasedCart } from "@/components/payments/ClearPurchasedCart";
import { PaymentStatusCard } from "@/components/payments/PaymentStatusCard";
import { findOrder } from "@/features/orders/order-service";
import { getPaymentConfiguration } from "@/lib/payments/gateway-registry";
import { purchaseHrefFromCookie } from "@/features/purchases/purchase-cookie";

export const metadata: Metadata = { title: "Pago pendiente", robots: { index: false } };

export default async function PagoPendientePage({
  searchParams,
}: PageProps<"/pago/pendiente">) {
  const params = await searchParams;
  const id = typeof params.pedido === "string" ? params.pedido : null;
  const order = id === null ? null : await findOrder(id);

  if (order?.status === "paid" || order?.status === "fulfilled") {
    const purchaseHref = await purchaseHrefFromCookie(order);
    return (
      <>
        <PaymentStatusCard
          eyebrow="Pago confirmado"
          title="PAGO CONFIRMADO"
          message="El pago ya fue confirmado por el servidor. La entrega se prepara de forma segura y no necesitás volver a pagar."
          order={order}
          secondaryHref={purchaseHref ?? "/"}
          secondaryLabel={purchaseHref === null ? "Volver al inicio" : "Ver mi compra"}
        />
        <ClearPurchasedCart slugs={order.items.map((item) => item.slug)} />
      </>
    );
  }

  const config = getPaymentConfiguration();
  const message = config.ready
    ? "Estamos esperando la confirmación segura del medio de pago. Tu carrito se mantiene intacto mientras el pedido no figure como pagado."
    : "El medio de pago todavía no está configurado. No se te cobró nada; el pedido queda guardado como pendiente y tu carrito se mantiene intacto.";

  return (
    <PaymentStatusCard
      eyebrow="Estado del pago"
      title="PAGO PENDIENTE"
      message={message}
      order={order}
    />
  );
}
