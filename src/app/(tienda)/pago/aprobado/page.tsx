import type { Metadata } from "next";
import { ClearPurchasedCart } from "@/components/payments/ClearPurchasedCart";
import { PaymentStatusCard } from "@/components/payments/PaymentStatusCard";
import { findOrder } from "@/features/orders/order-service";
import { resolveApprovedPageState } from "@/features/payments/payment-page-state";
import { purchaseHrefFromCookie } from "@/features/purchases/purchase-cookie";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: pick(locale, "Estado del pago", "Payment status", "Status do pagamento"), robots: { index: false } };
}

export default async function PagoAprobadoPage({
  searchParams,
}: PageProps<"/pago/aprobado">) {
  const locale = await getLocale();
  const params = await searchParams;
  const id = typeof params.pedido === "string" ? params.pedido : null;
  const order = id === null ? null : await findOrder(id);
  const state = resolveApprovedPageState(order?.status ?? null);
  const purchaseHref = order === null ? null : await purchaseHrefFromCookie(order);

  if (state === "confirmed") {
    return (
      <>
        <PaymentStatusCard
          locale={locale}
          eyebrow={pick(locale, "Pago confirmado", "Payment confirmed", "Pagamento confirmado")}
          title={pick(locale, "PAGO CONFIRMADO", "PAYMENT CONFIRMED", "PAGAMENTO CONFIRMADO")}
          message={pick(locale, "El proveedor confirmó el pago en el servidor. La entrega se prepara de forma segura y podés seguir su estado desde tu acceso privado.", "The provider confirmed the payment on the server. Delivery is being prepared securely, and you can follow its status from your private access page.", "O provedor confirmou o pagamento no servidor. A entrega está sendo preparada com segurança, e você pode acompanhar o status pelo seu acesso privado.")}
          order={order}
          secondaryHref={purchaseHref ?? "/"}
          secondaryLabel={purchaseHref === null ? pick(locale, "Volver al inicio", "Back to home", "Voltar ao início") : pick(locale, "Ver mi compra", "View my purchase", "Ver minha compra")}
        />
        {order !== null ? <ClearPurchasedCart slugs={order.items.map((item) => item.slug)} /> : null}
      </>
    );
  }

  if (state === "rejected") {
    return (
      <PaymentStatusCard
        locale={locale}
        eyebrow={pick(locale, "Pago sin confirmar", "Payment not confirmed", "Pagamento não confirmado")}
        title={pick(locale, "NO PUDIMOS CONFIRMAR EL PAGO", "WE COULD NOT CONFIRM THE PAYMENT", "NÃO FOI POSSÍVEL CONFIRMAR O PAGAMENTO")}
        message={pick(locale, "La dirección de esta página no demuestra que haya existido un cobro. El pedido persistido no figura como pagado.", "This page address does not prove that a charge took place. The saved order is not marked as paid.", "O endereço desta página não comprova que houve uma cobrança. O pedido registrado não consta como pago.")}
        order={order}
      />
    );
  }

  return (
    <PaymentStatusCard
      locale={locale}
      eyebrow={pick(locale, "Verificando el pago", "Verifying payment", "Verificando o pagamento")}
      title={pick(locale, "ESTAMOS CONFIRMANDO TU PAGO", "WE ARE CONFIRMING YOUR PAYMENT", "ESTAMOS CONFIRMANDO SEU PAGAMENTO")}
      message={pick(locale, "Llegar a esta página no aprueba una compra. Estamos esperando que el proveedor confirme el pago de forma segura en el servidor.", "Reaching this page does not approve a purchase. We are waiting for the provider to confirm the payment securely on the server.", "Chegar a esta página não aprova uma compra. Estamos aguardando o provedor confirmar o pagamento com segurança no servidor.")}
      order={order}
    />
  );
}
