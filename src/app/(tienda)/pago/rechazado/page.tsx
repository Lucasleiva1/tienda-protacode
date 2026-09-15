import type { Metadata } from "next";
import { ClearPurchasedCart } from "@/components/payments/ClearPurchasedCart";
import { PaymentStatusCard } from "@/components/payments/PaymentStatusCard";
import { findOrder } from "@/features/orders/order-service";

export const metadata: Metadata = { title: "Pago rechazado", robots: { index: false } };

export default async function PagoRechazadoPage({
  searchParams,
}: PageProps<"/pago/rechazado">) {
  const params = await searchParams;
  const id = typeof params.pedido === "string" ? params.pedido : null;
  const order = id === null ? null : await findOrder(id);

  if (order?.status === "paid" || order?.status === "fulfilled") {
    return (
      <>
        <PaymentStatusCard
          eyebrow="Pago confirmado"
          title="PAGO CONFIRMADO"
          message="Aunque llegaste por una dirección de rechazo, el estado persistido confirma que el pedido está pagado."
          order={order}
          secondaryHref="/"
          secondaryLabel="Volver al inicio"
        />
        <ClearPurchasedCart slugs={order.items.map((item) => item.slug)} />
      </>
    );
  }

  return (
    <PaymentStatusCard
      eyebrow="Estado del pago"
      title="PAGO RECHAZADO"
      message="El pedido no figura como pagado. No se generó ninguna licencia y tu carrito sigue intacto para que puedas volver cuando exista un medio de pago disponible."
      order={order}
    />
  );
}
