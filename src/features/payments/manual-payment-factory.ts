import "server-only";

import { createFulfillmentService } from "@/features/fulfillment/fulfillment-service";
import { createNotificationService } from "@/features/notifications/notification-service";
import { getOrderRepository } from "@/features/orders/persistent-order-repository";
import { ManualPaymentService } from "@/features/payments/manual-payment-service";
import { getPaymentProofStorage } from "@/features/payments/payment-proof-storage";
import { getPaymentRepository } from "@/features/payments/persistent-payment-repository";
import { getPaymentMethodSettings } from "@/features/settings/payment-method-settings";

/** Servicio de pagos manuales con las dependencias reales de la tienda. */
export function createManualPaymentService(): ManualPaymentService {
  return new ManualPaymentService({
    orders: getOrderRepository(),
    payments: getPaymentRepository(),
    proofs: getPaymentProofStorage(),
    methods: () => getPaymentMethodSettings(),
    delivery: { deliver: (orderId) => createFulfillmentService().fulfill(orderId) },
    notifications: createNotificationService(),
  });
}
