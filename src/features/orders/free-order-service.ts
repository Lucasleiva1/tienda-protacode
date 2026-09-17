import "server-only";

import {
  deliverAndNotify,
  type DeliveryNotifications,
  type OrderDelivery,
} from "@/features/fulfillment/delivery-coordinator";
import type { OrderReferenceRepository } from "@/features/orders/order-reference-repository";
import type { OrderRepository } from "@/features/orders/order-repository";
import {
  buildOrder,
  freezeOrderItem,
  persistNewOrder,
} from "@/features/orders/order-service";
import type { PaymentRepository } from "@/features/payments/payment-repository";
import type { PurchaseAccessRepository } from "@/features/purchases/purchase-access-repository";
import { paymentLog } from "@/lib/payments/payment-logger";
import type { CustomerAccount } from "@/types/customer-account";
import type { Order } from "@/types/order";
import type { Payment } from "@/types/payment";
import type { Product } from "@/types/product";

/**
 * Programas gratuitos que llevan licencia.
 *
 * No pasan por el pago, pero la licencia es un recurso limitado: por eso exigen
 * cuenta y se entregan UNA vez por cuenta y producto. Repetir el pedido devuelve el
 * mismo. Los gratuitos sin licencia siguen descargándose directo desde su ficha.
 */

export interface FreeOrderDependencies {
  readonly orders: OrderRepository;
  readonly payments: PaymentRepository;
  readonly access: PurchaseAccessRepository;
  readonly references: OrderReferenceRepository;
  readonly delivery: OrderDelivery;
  readonly notifications: DeliveryNotifications;
  readonly clock?: () => Date;
}

export type FreeOrderResult =
  | { readonly ok: true; readonly order: Order; readonly created: boolean }
  | { readonly ok: false; readonly code: "NOT_ELIGIBLE" | "ACCOUNT_NOT_VERIFIED" };

/** Una reserva sin pedido guardado se considera abandonada pasado este tiempo. */
const STALE_CLAIM_MS = 2 * 60_000;

export function isFreeLicenseProduct(product: Product): boolean {
  return product.pricingType === "free" && product.licenseRequired && product.published && !product.archived;
}

export async function claimFreeLicenseOrder(
  input: { readonly account: CustomerAccount; readonly product: Product },
  dependencies: FreeOrderDependencies,
): Promise<FreeOrderResult> {
  const { account, product } = input;
  if (!isFreeLicenseProduct(product)) return { ok: false, code: "NOT_ELIGIBLE" };
  if (!account.emailVerified) return { ok: false, code: "ACCOUNT_NOT_VERIFIED" };

  const clock = dependencies.clock ?? (() => new Date());
  const orderId = crypto.randomUUID();
  const indexKey = `free:${account.id}:${product.id}`;

  const claim = await dependencies.references.claimIndex(indexKey, orderId, async (existing) => {
    const found = await dependencies.orders.findById(existing.orderId);
    return found === null && clock().getTime() - Date.parse(existing.createdAt) > STALE_CLAIM_MS;
  });

  if (!claim.created) {
    const existing = await dependencies.orders.findById(claim.orderId);
    if (existing !== null) {
      // Si la entrega había quedado a medias, se completa sin crear otro pedido.
      if (existing.status === "paid") {
        const result = await deliverAndNotify(existing.id, dependencies);
        return { ok: true, order: result.order ?? existing, created: false };
      }
      return { ok: true, order: existing, created: false };
    }
    // Otro pedido se está creando en este mismo momento.
    return { ok: false, code: "NOT_ELIGIBLE" };
  }

  const now = clock().toISOString();
  const currency = product.currency;
  let saved: Order;
  try {
    const result = await persistNewOrder(
      (reference, access) =>
        buildOrder({
          id: orderId,
          reference,
          status: "paid",
          customer: {
            accountId: account.id,
            firstName: account.firstName,
            lastName: account.lastName,
            email: account.email,
            whatsapp: null,
          },
          items: [freezeOrderItem(product, currency, { free: true })],
          currency,
          payment: {
            paymentId: `pay-${orderId}`,
            status: "approved",
            provider: "free",
            providerReference: reference,
          },
          manualPayment: null,
          purchaseAccess: access.record,
          now,
        }),
      orderId,
      dependencies,
    );
    saved = result.order;
  } catch (error) {
    await dependencies.references.releaseIndex(indexKey, orderId);
    throw error;
  }

  const payment: Payment = {
    id: `pay-${orderId}`,
    orderId,
    provider: "free",
    externalPaymentId: `free:${orderId}`,
    status: "approved",
    amount: saved.total,
    checkoutUrl: null,
    idempotencyKey: `payment:${orderId}:free`,
    createdAt: now,
    updatedAt: now,
    approvedAt: now,
    failureReason: null,
  };
  await dependencies.payments.saveIfAbsentForOrder(payment);
  paymentLog("info", "FREE_LICENSE_ORDER_CREATED", { orderId, productId: product.id });

  const delivered = await deliverAndNotify(orderId, dependencies);
  return { ok: true, order: delivered.order ?? saved, created: true };
}
