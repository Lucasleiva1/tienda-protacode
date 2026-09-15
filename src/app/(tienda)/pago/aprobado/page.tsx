import type { Metadata } from "next";
import { ClearPurchasedCart } from "@/components/payments/ClearPurchasedCart";
import { PaymentStatusCard } from "@/components/payments/PaymentStatusCard";
import { findOrder } from "@/features/orders/order-service";
import { resolveApprovedPageState } from "@/features/payments/payment-page-state";
import { purchaseHrefFromCookie } from "@/features/purchases/purchase-cookie";

export const metadata: Metadata = { title: "Estado del pago", robots: { index: false } };

export default async function PagoAprobadoPage({
  searchParams,
}: PageProps<"/pago/aprobado">) {
  const params = await searchParams;
  const id = typeof params.pedido === "string" ? params.pedido : null;
  const order = id === null ? null : await findOrder(id);
  const state = resolveApprovedPageState(order?.status ?? null);
  const purchaseHref = order === null ? null : await purchaseHrefFromCookie(order);

  if (state === "confirmed") {
    return (
      <>
        <PaymentStatusCard
          eyebrow="Pago confirmado"
          title="PAGO CONFIRMADO"
          message="El proveedor confirmó el pago en el servidor. La entrega se prepara de forma segura y podés seguir su estado desde tu acceso privado."
          order={order}
          secondaryHref={purchaseHref ?? "/"}
          secondaryLabel={purchaseHref === null ? "Volver al inicio" : "Ver mi compra"}
        />
        {order !== null ? <ClearPurchasedCart slugs={order.items.map((item) => item.slug)} /> : null}
      </>
    );
  }

  if (state === "rejected") {
    return (
      <PaymentStatusCard
        eyebrow="Pago sin confirmar"
        title="NO PUDIMOS CONFIRMAR EL PAGO"
        message="La dirección de esta página no demuestra que haya existido un cobro. El pedido persistido no figura como pagado."
        order={order}
      />
    );
  }

  return (
    <PaymentStatusCard
      eyebrow="Verificando el pago"
      title="ESTAMOS CONFIRMANDO TU PAGO"
      message="Llegar a esta página no aprueba una compra. Estamos esperando que el proveedor confirme el pago de forma segura en el servidor."
      order={order}
    />
  );
}
