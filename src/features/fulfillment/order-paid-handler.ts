import "server-only";
import { fulfillmentLog } from "@/features/fulfillment/fulfillment-logger";
import {
  createFulfillmentService,
  type FulfillmentService,
} from "@/features/fulfillment/fulfillment-service";
import type { OrderPaidHandler } from "@/features/payments/order-paid-handler";

export function createFulfillmentOrderPaidHandler(
  service: FulfillmentService = createFulfillmentService(),
): OrderPaidHandler {
  return {
    async handle(order) {
      try {
        await service.fulfill(order.id);
      } catch {
        // El pago ya está confirmado: un fallo técnico de entrega jamás lo revierte.
        fulfillmentLog("error", "FULFILLMENT_ERROR", { orderId: order.id });
      }
    },
  };
}
