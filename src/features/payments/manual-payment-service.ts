import "server-only";

import {
  deliverAndNotify,
  type DeliveryNotifications,
  type OrderDelivery,
} from "@/features/fulfillment/delivery-coordinator";
import { orderDisplayReference } from "@/features/orders/order-display";
import type { OrderRepository } from "@/features/orders/order-repository";
import {
  acceptsCustomerPaymentActions,
  canTransitionManualPayment,
  paymentProviderName,
} from "@/features/payments/manual-payment-state";
import type { PaymentRepository } from "@/features/payments/payment-repository";
import type {
  PaymentProofStorage,
  PaymentProofUpload,
} from "@/features/payments/payment-proof-storage";
import { isPaymentMethodUsable } from "@/features/settings/payment-method-settings";
import { paymentLog } from "@/lib/payments/payment-logger";
import { transitionPaymentStatus } from "@/lib/payments/payment-state-machine";
import type { FulfillmentResult } from "@/types/fulfillment";
import type {
  ManualPaymentMethodId,
  PaymentMethodSettings,
  PaymentProofReference,
} from "@/types/manual-payment";
import type { Order } from "@/types/order";
import type { Payment } from "@/types/payment";

/**
 * Pagos manuales: el comprador informa, el Admin verifica.
 *
 * Todas las transiciones se hacen con escritura condicional sobre el pedido: dos
 * clics, dos pestañas o una solicitud repetida por mala conexión leen el estado
 * más reciente y solo una puede cambiarlo. "Ya pagué" y el comprobante jamás
 * aprueban un pago; solo `confirmPayment`, llamado desde una acción de Admin.
 */

export type ManualPaymentErrorCode =
  | "ORDER_NOT_FOUND"
  | "NOT_MANUAL_ORDER"
  | "METHOD_UNAVAILABLE"
  | "METHOD_REQUIRED"
  | "PAYMENT_ALREADY_REPORTED"
  | "PAYMENT_ALREADY_PAID"
  | "PAYMENT_REJECTED"
  | "ORDER_NOT_PAYABLE"
  | "ORDER_TOTAL_INVALID"
  | "PAYMENT_RECORD_CONFLICT";

const MESSAGES: Record<ManualPaymentErrorCode, string> = {
  ORDER_NOT_FOUND: "No encontramos el pedido.",
  NOT_MANUAL_ORDER: "Este pedido no usa pagos manuales.",
  METHOD_UNAVAILABLE: "Ese medio de pago no está disponible.",
  METHOD_REQUIRED: "Elegí primero cómo vas a pagar.",
  PAYMENT_ALREADY_REPORTED: "El pago ya fue informado y está en verificación.",
  PAYMENT_ALREADY_PAID: "El pago ya fue confirmado.",
  PAYMENT_REJECTED: "El pago de este pedido fue rechazado.",
  ORDER_NOT_PAYABLE: "El estado actual del pedido no permite esta acción.",
  ORDER_TOTAL_INVALID: "El total guardado del pedido no es válido.",
  PAYMENT_RECORD_CONFLICT: "El registro del pago tiene un estado incompatible. Revisalo antes de continuar.",
};

export type ManualPaymentFailure = {
  readonly ok: false;
  readonly code: ManualPaymentErrorCode;
  readonly message: string;
};

export type ManualPaymentResult =
  | { readonly ok: true; readonly order: Order; readonly changed: boolean }
  | ManualPaymentFailure;

export type PaymentReviewResult =
  | {
      readonly ok: true;
      readonly order: Order;
      /** `true` cuando el pago ya estaba en ese estado: no se repitió ningún efecto. */
      readonly duplicate: boolean;
      readonly delivery: FulfillmentResult | null;
    }
  | ManualPaymentFailure;

export interface ManualPaymentNotifications extends DeliveryNotifications {
  paymentReported(order: Order): Promise<unknown>;
}

export interface ManualPaymentDependencies {
  readonly orders: OrderRepository;
  readonly payments: PaymentRepository;
  readonly proofs: PaymentProofStorage;
  readonly methods: () => Promise<readonly PaymentMethodSettings[]>;
  readonly delivery: OrderDelivery;
  readonly notifications: ManualPaymentNotifications;
  readonly clock?: () => Date;
}

type Outcome =
  | "not_found"
  | "not_manual"
  | "not_payable"
  | "invalid_total"
  | "method_required"
  | "already_reported"
  | "already_paid"
  | "rejected"
  | "unchanged"
  | "changed"
  | "proof_attached"
  | "duplicate";

function failure(code: ManualPaymentErrorCode): ManualPaymentFailure {
  return { ok: false, code, message: MESSAGES[code] };
}

function outcomeFailure(outcome: Outcome): ManualPaymentFailure | null {
  switch (outcome) {
    case "not_found":
      return failure("ORDER_NOT_FOUND");
    case "not_manual":
      return failure("NOT_MANUAL_ORDER");
    case "not_payable":
      return failure("ORDER_NOT_PAYABLE");
    case "invalid_total":
      return failure("ORDER_TOTAL_INVALID");
    case "method_required":
      return failure("METHOD_REQUIRED");
    case "already_reported":
      return failure("PAYMENT_ALREADY_REPORTED");
    case "already_paid":
      return failure("PAYMENT_ALREADY_PAID");
    case "rejected":
      return failure("PAYMENT_REJECTED");
    default:
      return null;
  }
}

/** Traduce un estado final del pedido al motivo por el que ya no admite cambios. */
function closedOutcome(order: Order): Outcome {
  const manual = order.manualPayment;
  if (manual?.status === "paid") return "already_paid";
  if (manual?.status === "rejected") return "rejected";
  return "not_payable";
}

export function paymentIdFor(orderId: string): string {
  return `pay-${orderId}`;
}

/** Texto libre del Admin: una línea corta, sin controles. React lo escapa al mostrarlo. */
export function sanitizeRejectionReason(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const visible = Array.from(value, (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? " " : char;
  }).join("");
  const clean = visible.replace(/\s+/g, " ").trim();
  return clean === "" ? null : clean.slice(0, 300);
}

export class ManualPaymentService {
  constructor(private readonly dependencies: ManualPaymentDependencies) {}

  private now(): string {
    return (this.dependencies.clock?.() ?? new Date()).toISOString();
  }

  async selectMethod(orderId: string, methodId: ManualPaymentMethodId): Promise<ManualPaymentResult> {
    const methods = await this.dependencies.methods();
    const method = methods.find((candidate) => candidate.id === methodId);
    if (method === undefined || !isPaymentMethodUsable(method)) return failure("METHOD_UNAVAILABLE");

    const now = this.now();
    let outcome = "not_found" as Outcome;
    const updated = await this.dependencies.orders.updateAtomically(orderId, (current) => {
      const manual = current.manualPayment;
      if (manual === null) {
        outcome = "not_manual";
        return current;
      }
      if (current.status !== "pending" || manual.status === "paid" || manual.status === "rejected") {
        outcome = closedOutcome(current);
        return current;
      }
      if (manual.status === "awaiting_verification") {
        outcome = manual.method === method.id ? "unchanged" : "already_reported";
        return current;
      }
      if (manual.method === method.id && manual.methodLabel === method.name) {
        outcome = "unchanged";
        return current;
      }
      outcome = "changed";
      return {
        ...current,
        manualPayment: {
          ...manual,
          method: method.id,
          methodLabel: method.name,
          methodSelectedAt: now,
        },
      };
    });

    if (updated === null) return failure("ORDER_NOT_FOUND");
    const failed = outcomeFailure(outcome);
    if (failed !== null) return failed;
    if (outcome === "changed") {
      paymentLog("info", "MANUAL_PAYMENT_METHOD_SELECTED", { orderId, method: method.id });
    }
    return { ok: true, order: updated, changed: outcome === "changed" };
  }

  /**
   * "Ya pagué". Pasa a `awaiting_verification` una sola vez y avisa al Admin. Si ya
   * estaba informado, no repite el aviso; un comprobante nuevo solo se adjunta.
   */
  async reportPayment(
    orderId: string,
    upload: PaymentProofUpload | null = null,
  ): Promise<ManualPaymentResult> {
    return this.applyCustomerUpdate(orderId, upload, "report");
  }

  /** Adjunta o reemplaza el comprobante sin cambiar el estado del pago. */
  async attachProof(orderId: string, upload: PaymentProofUpload): Promise<ManualPaymentResult> {
    return this.applyCustomerUpdate(orderId, upload, "attach");
  }

  private async applyCustomerUpdate(
    orderId: string,
    upload: PaymentProofUpload | null,
    mode: "report" | "attach",
  ): Promise<ManualPaymentResult> {
    const { orders, proofs } = this.dependencies;

    // Se valida antes de guardar un archivo, para no almacenar basura.
    const before = await orders.findById(orderId);
    if (before === null) return failure("ORDER_NOT_FOUND");
    if (before.manualPayment === null) return failure("NOT_MANUAL_ORDER");
    if (!acceptsCustomerPaymentActions(before)) {
      return outcomeFailure(closedOutcome(before)) ?? failure("ORDER_NOT_PAYABLE");
    }
    if (before.manualPayment.method === null) return failure("METHOD_REQUIRED");

    const saved: PaymentProofReference | null =
      upload === null ? null : await proofs.save(orderId, upload);
    const now = this.now();
    let outcome = "not_found" as Outcome;
    let replaced: PaymentProofReference | null = null;

    let updated: Order | null;
    try {
      updated = await orders.updateAtomically(orderId, (current) => {
        replaced = null;
        const manual = current.manualPayment;
        if (manual === null) {
          outcome = "not_manual";
          return current;
        }
        if (current.status !== "pending" || manual.status === "paid" || manual.status === "rejected") {
          outcome = closedOutcome(current);
          return current;
        }
        if (manual.method === null) {
          outcome = "method_required";
          return current;
        }

        const proof = saved ?? manual.proof;
        if (saved !== null) replaced = manual.proof;

        if (mode === "report" && manual.status === "pending") {
          outcome = "changed";
          return {
            ...current,
            manualPayment: { ...manual, status: "awaiting_verification", reportedAt: now, proof },
          };
        }

        if (saved === null) {
          outcome = "unchanged";
          return current;
        }
        outcome = "proof_attached";
        return { ...current, manualPayment: { ...manual, proof } };
      });
    } catch (error) {
      if (saved !== null) await proofs.remove(saved.storageKey);
      throw error;
    }

    const failed = updated === null ? failure("ORDER_NOT_FOUND") : outcomeFailure(outcome);
    if (failed !== null) {
      if (saved !== null) await proofs.remove(saved.storageKey);
      return failed;
    }
    const order = updated as Order;

    const previous = replaced as PaymentProofReference | null;
    if (previous !== null && previous.storageKey !== saved?.storageKey) {
      await proofs.remove(previous.storageKey);
    }
    if (saved !== null) {
      paymentLog("info", "MANUAL_PAYMENT_PROOF_ATTACHED", { orderId, size: saved.size });
    }

    if (outcome === "changed") {
      paymentLog("info", "MANUAL_PAYMENT_REPORTED", {
        orderId,
        reference: orderDisplayReference(order),
        method: order.manualPayment?.method ?? null,
      });
      try {
        await this.dependencies.notifications.paymentReported(order);
      } catch {
        paymentLog("warn", "MANUAL_PAYMENT_NOTIFICATION_FAILED", { orderId });
      }
    }

    return { ok: true, order, changed: outcome !== "unchanged" };
  }

  /**
   * Confirmación del Admin. OPERACIÓN CRÍTICA E IDEMPOTENTE.
   *
   * 1. transición atómica pending/awaiting_verification → paid (una sola gana);
   * 2. registro de pago aprobado (idempotente);
   * 3. entrega de licencia y descarga con claves de idempotencia estables.
   *
   * Repetirla no genera otra licencia ni otro pedido: devuelve `duplicate: true` y,
   * si la entrega había quedado a medias, solo la completa.
   */
  async confirmPayment(orderId: string, actor: string): Promise<PaymentReviewResult> {
    const now = this.now();
    let outcome = "not_found" as Outcome;

    const updated = await this.dependencies.orders.updateAtomically(orderId, (current) => {
      const manual = current.manualPayment;
      if (manual === null) {
        outcome = "not_manual";
        return current;
      }
      if (manual.status === "paid") {
        outcome = "duplicate";
        return current;
      }
      if (manual.status === "rejected") {
        outcome = "rejected";
        return current;
      }
      if (current.status !== "pending" || !canTransitionManualPayment(manual.status, "paid")) {
        outcome = "not_payable";
        return current;
      }
      if (
        !Number.isSafeInteger(current.total.amount) ||
        current.total.amount <= 0 ||
        current.total.currency !== current.currency
      ) {
        outcome = "invalid_total";
        return current;
      }
      outcome = "changed";
      return {
        ...current,
        status: "paid",
        payment: {
          paymentId: paymentIdFor(current.id),
          status: "approved",
          provider: paymentProviderName(manual.method),
          providerReference: orderDisplayReference(current),
        },
        manualPayment: { ...manual, status: "paid", paidAt: now, approvedBy: actor },
      };
    });

    if (updated === null) return failure("ORDER_NOT_FOUND");
    const failed = outcomeFailure(outcome);
    if (failed !== null) return failed;

    const record = await this.ensurePaymentRecord(updated, now);
    if (record === null) {
      paymentLog("error", "MANUAL_PAYMENT_RECORD_CONFLICT", { orderId });
      return failure("PAYMENT_RECORD_CONFLICT");
    }

    paymentLog("info", outcome === "changed" ? "MANUAL_PAYMENT_CONFIRMED" : "MANUAL_PAYMENT_CONFIRM_REPEATED", {
      orderId,
      reference: orderDisplayReference(updated),
      method: updated.manualPayment?.method ?? null,
    });

    const result = await deliverAndNotify(orderId, this.dependencies);
    return {
      ok: true,
      order: result.order ?? updated,
      duplicate: outcome === "duplicate",
      delivery: result.delivery,
    };
  }

  async rejectPayment(
    orderId: string,
    actor: string,
    reason: string | null,
  ): Promise<PaymentReviewResult> {
    const now = this.now();
    const cleanReason = sanitizeRejectionReason(reason);
    let outcome = "not_found" as Outcome;

    const updated = await this.dependencies.orders.updateAtomically(orderId, (current) => {
      const manual = current.manualPayment;
      if (manual === null) {
        outcome = "not_manual";
        return current;
      }
      if (manual.status === "rejected") {
        outcome = "duplicate";
        return current;
      }
      if (manual.status === "paid") {
        outcome = "already_paid";
        return current;
      }
      if (current.status !== "pending" || !canTransitionManualPayment(manual.status, "rejected")) {
        outcome = "not_payable";
        return current;
      }
      outcome = "changed";
      return {
        ...current,
        status: "failed",
        payment: { ...current.payment, status: "rejected" },
        manualPayment: {
          ...manual,
          status: "rejected",
          rejectedAt: now,
          rejectedBy: actor,
          rejectionReason: cleanReason,
        },
      };
    });

    if (updated === null) return failure("ORDER_NOT_FOUND");
    const failed = outcomeFailure(outcome);
    if (failed !== null) return failed;

    if (outcome === "changed") {
      paymentLog("info", "MANUAL_PAYMENT_REJECTED", {
        orderId,
        reference: orderDisplayReference(updated),
      });
    }
    return { ok: true, order: updated, duplicate: outcome === "duplicate", delivery: null };
  }

  /** Reintento de entrega sin volver a confirmar el pago. */
  async retryDelivery(orderId: string): Promise<PaymentReviewResult> {
    const order = await this.dependencies.orders.findById(orderId);
    if (order === null) return failure("ORDER_NOT_FOUND");
    if (order.status !== "paid" || order.payment.status !== "approved") {
      return failure("ORDER_NOT_PAYABLE");
    }
    const result = await deliverAndNotify(orderId, this.dependencies);
    return { ok: true, order: result.order ?? order, duplicate: false, delivery: result.delivery };
  }

  /** Crea o completa el registro `Payment` aprobado que exige la entrega. */
  private async ensurePaymentRecord(order: Order, now: string): Promise<Payment | null> {
    const paidAt = order.manualPayment?.paidAt ?? now;
    const draft: Payment = {
      id: paymentIdFor(order.id),
      orderId: order.id,
      provider: order.payment.provider ?? "manual",
      externalPaymentId: `manual:${order.id}`,
      status: "approved",
      amount: order.total,
      checkoutUrl: null,
      idempotencyKey: `payment:${order.id}:manual`,
      createdAt: paidAt,
      updatedAt: paidAt,
      approvedAt: paidAt,
      failureReason: null,
    };

    const reserved = await this.dependencies.payments.saveIfAbsentForOrder(draft);
    if (reserved.payment.status === "approved") return reserved.payment;

    const result = await this.dependencies.payments.updateAtomically(reserved.payment.id, (current) => {
      const transition = transitionPaymentStatus(current.status, "approved");
      if (!transition.allowed || !transition.changed) return current;
      return { ...current, status: "approved", approvedAt: paidAt, updatedAt: now, failureReason: null };
    });
    return result?.payment.status === "approved" ? result.payment : null;
  }
}
