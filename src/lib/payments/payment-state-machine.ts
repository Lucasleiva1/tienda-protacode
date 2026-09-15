import type { OrderStatus } from "@/types/order";
import type { PaymentStatus, ProviderPaymentStatus } from "@/types/payment";

export interface StateTransition<T extends string> {
  readonly allowed: boolean;
  readonly changed: boolean;
  readonly state: T;
}

const PAYMENT_TRANSITIONS: Readonly<Record<PaymentStatus, readonly PaymentStatus[]>> = {
  not_started: ["pending", "error"],
  pending: ["approved", "rejected", "cancelled", "error"],
  approved: ["refunded"],
  rejected: [],
  cancelled: [],
  refunded: [],
  error: ["pending"],
};

export function transitionPaymentStatus(
  current: PaymentStatus,
  target: PaymentStatus,
): StateTransition<PaymentStatus> {
  if (current === target) return { allowed: true, changed: false, state: current };
  if (!PAYMENT_TRANSITIONS[current].includes(target)) {
    return { allowed: false, changed: false, state: current };
  }
  return { allowed: true, changed: true, state: target };
}

export function transitionOrderForPayment(
  current: OrderStatus,
  payment: ProviderPaymentStatus,
): StateTransition<OrderStatus> {
  if (payment === "approved") {
    if (current === "pending") return { allowed: true, changed: true, state: "paid" };
    if (current === "paid" || current === "fulfilled") {
      return { allowed: true, changed: false, state: current };
    }
    return { allowed: false, changed: false, state: current };
  }

  if (payment === "rejected") {
    if (current === "pending") return { allowed: true, changed: true, state: "failed" };
    if (current === "failed") return { allowed: true, changed: false, state: current };
    return { allowed: false, changed: false, state: current };
  }

  if (payment === "cancelled") {
    if (current === "pending") {
      return { allowed: true, changed: true, state: "cancelled" };
    }
    if (current === "cancelled") return { allowed: true, changed: false, state: current };
    return { allowed: false, changed: false, state: current };
  }

  // pending y refunded no degradan ni reinterpretan el estado comercial del pedido.
  return { allowed: true, changed: false, state: current };
}
