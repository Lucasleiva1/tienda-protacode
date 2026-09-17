import "server-only";

import { fulfillmentLog } from "@/features/fulfillment/fulfillment-logger";
import type { OrderRepository } from "@/features/orders/order-repository";
import { isPaymentConfirmed } from "@/features/payments/manual-payment-state";
import type { FulfillmentResult } from "@/types/fulfillment";
import type { Order } from "@/types/order";

/** Motor de entrega (licencia + descarga). Lo implementa `FulfillmentService`. */
export interface OrderDelivery {
  deliver(orderId: string): Promise<FulfillmentResult>;
}

/** Avisos al comprador. Cada uno se envía como máximo una vez por pedido. */
export interface DeliveryNotifications {
  paymentApproved(order: Order): Promise<unknown>;
  deliveryReady(order: Order): Promise<unknown>;
}

export interface DeliveryCoordinatorDependencies {
  readonly orders: OrderRepository;
  readonly delivery: OrderDelivery;
  readonly notifications: DeliveryNotifications;
}

/**
 * Ejecuta la entrega de un pedido pagado y avisa al comprador.
 *
 * Es idempotente: se puede llamar después de confirmar, al reintentar desde el
 * Admin o ante una confirmación repetida. Una falla técnica de la entrega nunca
 * revierte el pago: el pedido queda pagado con la licencia pendiente.
 */
export async function deliverAndNotify(
  orderId: string,
  dependencies: DeliveryCoordinatorDependencies,
): Promise<{ readonly order: Order | null; readonly delivery: FulfillmentResult | null }> {
  let delivery: FulfillmentResult | null = null;
  try {
    delivery = await dependencies.delivery.deliver(orderId);
  } catch {
    fulfillmentLog("error", "FULFILLMENT_ERROR", { orderId });
  }

  const order = await dependencies.orders.findById(orderId);
  if (order !== null && isPaymentConfirmed(order)) {
    try {
      if (order.status === "fulfilled") {
        await dependencies.notifications.deliveryReady(order);
      } else if (order.total.amount > 0) {
        await dependencies.notifications.paymentApproved(order);
      }
    } catch {
      fulfillmentLog("warn", "FULFILLMENT_ERROR", { orderId, stage: "notification" });
    }
  }

  return { order, delivery };
}
