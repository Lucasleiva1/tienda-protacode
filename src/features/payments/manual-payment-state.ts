import type {
  ManualPaymentMethodId,
  ManualPaymentStatus,
  OrderManualPayment,
} from "@/types/manual-payment";
import type { LicenseStatus, Order, OrderItem } from "@/types/order";

/**
 * Estados del pago manual y del pedido, sin dependencias de servidor.
 *
 * El estado general del pedido NO se guarda: se calcula a partir del estado
 * comercial persistido (`order.status`) y del bloque de pago manual. Guardar dos
 * copias del mismo hecho es lo que produce combinaciones imposibles.
 */

export function initialManualPayment(): OrderManualPayment {
  return {
    status: "pending",
    method: null,
    methodLabel: null,
    methodSelectedAt: null,
    reportedAt: null,
    proof: null,
    paidAt: null,
    approvedBy: null,
    rejectedAt: null,
    rejectedBy: null,
    rejectionReason: null,
  };
}

const TRANSITIONS: Readonly<Record<ManualPaymentStatus, readonly ManualPaymentStatus[]>> = {
  pending: ["awaiting_verification", "paid", "rejected"],
  awaiting_verification: ["paid", "rejected"],
  paid: [],
  rejected: [],
};

export function canTransitionManualPayment(
  from: ManualPaymentStatus,
  to: ManualPaymentStatus,
): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Estado general visible.
 *
 * pending               → pedido creado, falta elegir cómo pagar
 * awaiting_payment      → medio elegido, falta pagar e informar
 * awaiting_verification → pago informado, falta que el Admin lo verifique
 * paid                  → pago confirmado, entrega en preparación
 * completed             → pago confirmado y entrega completa
 * rejected              → pago rechazado
 * cancelled             → pedido cancelado
 */
export const ORDER_STAGES = [
  "pending",
  "awaiting_payment",
  "awaiting_verification",
  "paid",
  "completed",
  "rejected",
  "cancelled",
] as const;

export type OrderStage = (typeof ORDER_STAGES)[number];

export function getOrderStage(order: Pick<Order, "status" | "payment" | "manualPayment">): OrderStage {
  switch (order.status) {
    case "cancelled":
      return "cancelled";
    case "fulfilled":
      return "completed";
    case "paid":
      return "paid";
    case "failed":
      return "rejected";
    case "pending":
      break;
  }

  const manual = order.manualPayment;
  if (manual === null) {
    return order.payment.status === "pending" ? "awaiting_payment" : "pending";
  }
  if (manual.status === "awaiting_verification") return "awaiting_verification";
  return manual.method === null ? "pending" : "awaiting_payment";
}

/** El comprador puede elegir medio, informar el pago o subir comprobante. */
export function acceptsCustomerPaymentActions(order: Order): boolean {
  return (
    order.status === "pending" &&
    order.manualPayment !== null &&
    (order.manualPayment.status === "pending" ||
      order.manualPayment.status === "awaiting_verification")
  );
}

/** El Admin puede confirmar o rechazar. */
export function acceptsAdminReview(order: Order): boolean {
  return (
    order.status === "pending" &&
    order.manualPayment !== null &&
    (order.manualPayment.status === "pending" ||
      order.manualPayment.status === "awaiting_verification")
  );
}

export function isPaymentConfirmed(order: Pick<Order, "status" | "payment">): boolean {
  return (
    (order.status === "paid" || order.status === "fulfilled") &&
    order.payment.status === "approved"
  );
}

/** Un ítem quedó con su licencia resuelta: asignada o no requerida. */
export function isLicenseResolved(item: OrderItem): boolean {
  return (
    item.licenseStatus === "not_required" ||
    (item.licenseStatus === "issued" && item.licenseKey !== null)
  );
}

export function isItemDownloadEnabled(order: Order, item: OrderItem): boolean {
  return (
    isPaymentConfirmed(order) &&
    isLicenseResolved(item) &&
    item.downloadFile !== null &&
    item.downloadEnabledAt !== null
  );
}

export function isDownloadEnabled(order: Order): boolean {
  return order.items.some((item) => isItemDownloadEnabled(order, item));
}

/**
 * Nombres de licencia que usa el negocio.
 *
 * El dato persistido conserva los valores históricos (`not_requested`, `issued`…);
 * esto solo los traduce a pending / assigning / assigned / failed / not_required.
 */
export type LicenseDeliveryState =
  | "pending"
  | "assigning"
  | "assigned"
  | "failed"
  | "not_required";

export function licenseDeliveryState(status: LicenseStatus): LicenseDeliveryState {
  switch (status) {
    case "not_requested":
      return "pending";
    case "pending":
      return "assigning";
    case "issued":
      return "assigned";
    case "failed":
      return "failed";
    case "not_required":
      return "not_required";
  }
}

export function paymentProviderName(method: ManualPaymentMethodId | null): string {
  return method === null ? "manual" : `manual:${method}`;
}
