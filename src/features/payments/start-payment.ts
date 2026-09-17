"use server";

import { createPaymentService } from "@/features/payments/payment-service";
import type { StartPaymentResult } from "@/features/payments/payment-service";
import { isOrderId } from "@/features/orders/order-id";

export type StartPaymentActionResult =
  | {
      readonly ok: true;
      readonly checkoutUrl: string | null;
      readonly reused: boolean;
    }
  | Extract<StartPaymentResult, { readonly ok: false }>;

/**
 * Entrada pública server-side del inicio de pago.
 *
 * El cliente entrega únicamente orderId. Importe, moneda y email se vuelven a leer
 * del pedido persistido dentro de PaymentService.
 */
export async function startPaymentAction(
  orderId: string,
): Promise<StartPaymentActionResult> {
  if (typeof orderId !== "string" || !isOrderId(orderId)) {
    return { ok: false, code: "ORDER_NOT_FOUND", message: "El pedido no existe." };
  }

  const encoded = encodeURIComponent(orderId);
  const result = await createPaymentService().startPayment(orderId, {
    successUrl: `/pago/aprobado?pedido=${encoded}`,
    pendingUrl: `/pago/pendiente?pedido=${encoded}`,
    failureUrl: `/pago/rechazado?pedido=${encoded}`,
  });

  if (!result.ok) return result;
  return { ok: true, checkoutUrl: result.checkoutUrl, reused: result.reused };
}
