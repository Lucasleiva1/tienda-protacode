import "server-only";
import { createFulfillmentOrderPaidHandler } from "@/features/fulfillment/order-paid-handler";
import type { OrderPaidHandler } from "@/features/payments/order-paid-handler";
import { noOpOrderPaidHandler } from "@/features/payments/order-paid-handler";
import { getPaymentRepository } from "@/features/payments/persistent-payment-repository";
import type { PaymentRepository } from "@/features/payments/payment-repository";
import { getOrderRepository } from "@/features/orders/persistent-order-repository";
import type { OrderRepository } from "@/features/orders/order-repository";
import { isOrderId } from "@/features/orders/order-id";
import { getPaymentGateway } from "@/lib/payments/gateway-registry";
import {
  PaymentGatewayError,
  type PaymentGateway,
  type PaymentGatewayErrorCode,
} from "@/lib/payments/payment-gateway";
import { paymentLog } from "@/lib/payments/payment-logger";
import {
  transitionOrderForPayment,
  transitionPaymentStatus,
} from "@/lib/payments/payment-state-machine";
import type { Order } from "@/types/order";
import type { Payment, VerifiedPaymentEvent } from "@/types/payment";

export interface StartPaymentUrls {
  readonly successUrl: string;
  readonly pendingUrl: string;
  readonly failureUrl: string;
}

export type StartPaymentErrorCode =
  | PaymentGatewayErrorCode
  | "ORDER_NOT_FOUND"
  | "ORDER_ALREADY_PAID"
  | "ORDER_NOT_PAYABLE"
  | "ORDER_TOTAL_INVALID"
  | "PAYMENT_ALREADY_FINISHED";

export type StartPaymentResult =
  | {
      readonly ok: true;
      readonly payment: Payment;
      readonly checkoutUrl: string | null;
      readonly reused: boolean;
    }
  | {
      readonly ok: false;
      readonly code: StartPaymentErrorCode;
      readonly message: string;
    };

export type ProcessPaymentEventResult =
  | {
      readonly ok: true;
      readonly duplicate: boolean;
      readonly paymentStatus: Payment["status"];
      readonly orderStatus: Order["status"];
    }
  | {
      readonly ok: false;
      readonly duplicate: false;
      readonly code:
        | "ORDER_NOT_FOUND"
        | "PAYMENT_NOT_FOUND"
        | "PAYMENT_CORRELATION_MISMATCH"
        | "PAYMENT_AMOUNT_MISMATCH"
        | "PAYMENT_CURRENCY_MISMATCH"
        | "PAYMENT_STATE_TRANSITION_NOT_ALLOWED"
        | "ORDER_STATE_TRANSITION_NOT_ALLOWED";
      readonly message: string;
    };

export interface PaymentServiceDependencies {
  readonly orders: OrderRepository;
  readonly payments: PaymentRepository;
  readonly gateway: PaymentGateway;
  readonly orderPaidHandler?: OrderPaidHandler;
}

function safeOccurredAt(value: string): string {
  return Number.isNaN(Date.parse(value)) ? new Date().toISOString() : value;
}

function paymentDescription(order: Order): string {
  return `Pedido ${order.id.slice(0, 8).toUpperCase()} · ${order.items.length} programa${order.items.length === 1 ? "" : "s"}`;
}

function isSafeCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value, "http://prota-code.local");
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export class PaymentService {
  private readonly orderPaidHandler: OrderPaidHandler;

  constructor(private readonly dependencies: PaymentServiceDependencies) {
    this.orderPaidHandler = dependencies.orderPaidHandler ?? noOpOrderPaidHandler;
  }

  async startPayment(orderId: string, urls: StartPaymentUrls): Promise<StartPaymentResult> {
    const { orders, payments, gateway } = this.dependencies;
    if (!isOrderId(orderId)) {
      return { ok: false, code: "ORDER_NOT_FOUND", message: "El pedido no existe." };
    }
    const order = await orders.findById(orderId);

    if (order === null) {
      return { ok: false, code: "ORDER_NOT_FOUND", message: "El pedido no existe." };
    }
    if (order.status === "paid" || order.status === "fulfilled") {
      return {
        ok: false,
        code: "ORDER_ALREADY_PAID",
        message: "El pedido ya está pagado.",
      };
    }
    if (order.status !== "pending") {
      return {
        ok: false,
        code: "ORDER_NOT_PAYABLE",
        message: "El estado actual del pedido no permite iniciar un pago.",
      };
    }
    if (
      !Number.isSafeInteger(order.total.amount) ||
      order.total.amount <= 0 ||
      order.total.currency !== order.currency
    ) {
      return {
        ok: false,
        code: "ORDER_TOTAL_INVALID",
        message: "El total persistido del pedido no es válido.",
      };
    }

    if (!gateway.enabled) {
      try {
        await gateway.createPayment({
          orderId: order.id,
          amount: order.total.amount,
          currency: order.currency,
          customerEmail: order.customer.email,
          description: paymentDescription(order),
          ...urls,
          idempotencyKey: `payment:${order.id}:create`,
        });
      } catch (error) {
        const gatewayError = error instanceof PaymentGatewayError ? error : null;
        const code = gatewayError?.code ?? "PAYMENT_PROVIDER_ERROR";
        paymentLog("warn", "PAYMENT_START_BLOCKED", { orderId: order.id, code });
        return {
          ok: false,
          code,
          message: gatewayError?.message ?? "No se pudo iniciar el pago.",
        };
      }
    }

    const existing = await payments.findByOrderId(order.id);
    if (existing !== null) {
      if (existing.status === "pending") {
        return {
          ok: true,
          payment: existing,
          checkoutUrl: existing.checkoutUrl,
          reused: true,
        };
      }
      return {
        ok: false,
        code: "PAYMENT_ALREADY_FINISHED",
        message: "El pedido ya tiene un intento de pago finalizado.",
      };
    }

    const now = new Date().toISOString();
    const draft: Payment = {
      id: `pay-${order.id}`,
      orderId: order.id,
      provider: gateway.provider,
      externalPaymentId: null,
      status: "pending",
      amount: order.total,
      checkoutUrl: null,
      idempotencyKey: `payment:${order.id}:create`,
      createdAt: now,
      updatedAt: now,
      approvedAt: null,
      failureReason: null,
    };

    const reserved = await payments.saveIfAbsentForOrder(draft);
    if (!reserved.created) {
      return {
        ok: true,
        payment: reserved.payment,
        checkoutUrl: reserved.payment.checkoutUrl,
        reused: true,
      };
    }

    paymentLog("info", "PAYMENT_CREATED", {
      paymentId: draft.id,
      orderId: order.id,
      provider: gateway.provider,
    });

    try {
      const created = await gateway.createPayment({
        orderId: order.id,
        amount: order.total.amount,
        currency: order.currency,
        customerEmail: order.customer.email,
        description: paymentDescription(order),
        ...urls,
        idempotencyKey: draft.idempotencyKey,
      });

      if (
        created.provider !== gateway.provider ||
        created.externalPaymentId.trim() === "" ||
        !isSafeCheckoutUrl(created.checkoutUrl)
      ) {
        throw new PaymentGatewayError(
          "PAYMENT_PROVIDER_ERROR",
          "El provider devolvió una respuesta de pago inválida.",
        );
      }

      const updated: Payment = {
        ...draft,
        externalPaymentId: created.externalPaymentId,
        checkoutUrl: created.checkoutUrl,
        updatedAt: new Date().toISOString(),
      };
      await payments.update(updated);
      await this.syncOrderPayment(order, updated);
      paymentLog("info", "PAYMENT_PENDING", {
        paymentId: updated.id,
        orderId: order.id,
        provider: updated.provider,
      });

      return { ok: true, payment: updated, checkoutUrl: updated.checkoutUrl, reused: false };
    } catch (error) {
      const gatewayError = error instanceof PaymentGatewayError ? error : null;
      const code = gatewayError?.code ?? "PAYMENT_PROVIDER_ERROR";
      const failed: Payment = {
        ...draft,
        status: "error",
        failureReason: code,
        updatedAt: new Date().toISOString(),
      };
      await payments.update(failed);
      await this.syncOrderPayment(order, failed);
      paymentLog("error", "PAYMENT_PROVIDER_ERROR", {
        paymentId: failed.id,
        orderId: order.id,
        provider: gateway.provider,
        code,
      });
      return {
        ok: false,
        code,
        message: gatewayError?.message ?? "No se pudo iniciar el pago.",
      };
    }
  }

  async processVerifiedEvent(
    event: VerifiedPaymentEvent,
  ): Promise<ProcessPaymentEventResult> {
    const { orders, payments } = this.dependencies;
    if (!isOrderId(event.orderId)) {
      return {
        ok: false,
        duplicate: false,
        code: "ORDER_NOT_FOUND",
        message: "El evento corresponde a un pedido inexistente.",
      };
    }
    paymentLog("info", "WEBHOOK_VERIFIED", {
      provider: event.provider,
      eventId: event.eventId,
      orderId: event.orderId,
    });

    const order = await orders.findById(event.orderId);
    if (order === null) {
      return {
        ok: false,
        duplicate: false,
        code: "ORDER_NOT_FOUND",
        message: "El evento corresponde a un pedido inexistente.",
      };
    }

    const payment =
      (await payments.findByExternalPaymentId(event.provider, event.externalPaymentId)) ??
      (await payments.findByOrderId(event.orderId));
    if (payment === null) {
      return {
        ok: false,
        duplicate: false,
        code: "PAYMENT_NOT_FOUND",
        message: "No existe un pago correlacionado con el evento.",
      };
    }

    if (
      payment.orderId !== event.orderId ||
      payment.provider !== event.provider ||
      payment.externalPaymentId !== event.externalPaymentId
    ) {
      paymentLog("warn", "PAYMENT_CORRELATION_MISMATCH", {
        paymentId: payment.id,
        orderId: event.orderId,
        provider: event.provider,
      });
      return {
        ok: false,
        duplicate: false,
        code: "PAYMENT_CORRELATION_MISMATCH",
        message: "El evento no coincide con el pago persistido.",
      };
    }

    const claimed = await payments.claimWebhookEvent(
      event.provider,
      event.eventId,
      payment.id,
    );
    if (!claimed) {
      paymentLog("info", "WEBHOOK_DUPLICATE", {
        paymentId: payment.id,
        eventId: event.eventId,
        provider: event.provider,
      });
      return {
        ok: true,
        duplicate: true,
        paymentStatus: payment.status,
        orderStatus: order.status,
      };
    }

    try {
      if (event.amount !== order.total.amount || event.amount !== payment.amount.amount) {
        await this.markValidationError(payment.id, "amount_mismatch", order);
        paymentLog("warn", "PAYMENT_AMOUNT_MISMATCH", {
          paymentId: payment.id,
          orderId: order.id,
          expected: order.total.amount,
          received: event.amount,
        });
        return {
          ok: false,
          duplicate: false,
          code: "PAYMENT_AMOUNT_MISMATCH",
          message: "El monto verificado no coincide con el pedido.",
        };
      }

      if (event.currency !== order.currency || event.currency !== payment.amount.currency) {
        await this.markValidationError(payment.id, "currency_mismatch", order);
        paymentLog("warn", "PAYMENT_CURRENCY_MISMATCH", {
          paymentId: payment.id,
          orderId: order.id,
          expected: order.currency,
          received: event.currency,
        });
        return {
          ok: false,
          duplicate: false,
          code: "PAYMENT_CURRENCY_MISMATCH",
          message: "La moneda verificada no coincide con el pedido.",
        };
      }

      let transitionAllowed = true;
      const paymentUpdate = await payments.updateAtomically(payment.id, (current) => {
        const transition = transitionPaymentStatus(current.status, event.status);
        transitionAllowed = transition.allowed;
        if (!transition.allowed || !transition.changed) return current;
        return {
          ...current,
          status: transition.state,
          approvedAt:
            transition.state === "approved"
              ? safeOccurredAt(event.occurredAt)
              : current.approvedAt,
          failureReason:
            transition.state === "rejected" ? "provider_rejected" : null,
          updatedAt: new Date().toISOString(),
        };
      });

      if (paymentUpdate === null || !transitionAllowed) {
        return {
          ok: false,
          duplicate: false,
          code: "PAYMENT_STATE_TRANSITION_NOT_ALLOWED",
          message: "La transición de estado del pago no está permitida.",
        };
      }

      const orderTransition = transitionOrderForPayment(order.status, event.status);
      if (!orderTransition.allowed) {
        await this.syncOrderPayment(order, paymentUpdate.payment);
        paymentLog("warn", "ORDER_STATE_TRANSITION_BLOCKED", {
          paymentId: payment.id,
          orderId: order.id,
          orderStatus: order.status,
          paymentStatus: event.status,
        });
        return {
          ok: false,
          duplicate: false,
          code: "ORDER_STATE_TRANSITION_NOT_ALLOWED",
          message: "El estado del pedido impide aplicar el evento de pago.",
        };
      }

      let nextOrder = order;
      if (orderTransition.changed) {
        nextOrder = {
          ...order,
          status: orderTransition.state,
          payment: this.orderPaymentProjection(paymentUpdate.payment),
          updatedAt: new Date().toISOString(),
        };
        await orders.update(nextOrder);

        if (nextOrder.status === "paid") {
          paymentLog("info", "ORDER_PAID", {
            paymentId: payment.id,
            orderId: order.id,
            provider: event.provider,
          });
          await this.orderPaidHandler.handle(nextOrder);
        }
      } else {
        await this.syncOrderPayment(order, paymentUpdate.payment);
        // Si una señal verificada se repite después de un fallo técnico de entrega,
        // fulfillment puede reintentarse con la misma idempotency key.
        if (order.status === "paid" && paymentUpdate.payment.status === "approved") {
          await this.orderPaidHandler.handle({
            ...order,
            payment: this.orderPaymentProjection(paymentUpdate.payment),
          });
        }
      }

      paymentLog("info", `PAYMENT_${event.status.toUpperCase()}`, {
        paymentId: payment.id,
        orderId: order.id,
        provider: event.provider,
      });
      return {
        ok: true,
        duplicate: false,
        paymentStatus: paymentUpdate.payment.status,
        orderStatus: nextOrder.status,
      };
    } catch (error) {
      await payments.releaseWebhookEvent(event.provider, event.eventId);
      throw error;
    }
  }

  private orderPaymentProjection(payment: Payment): Order["payment"] {
    return {
      paymentId: payment.id,
      status: payment.status,
      provider: payment.provider,
      providerReference: payment.externalPaymentId,
    };
  }

  private async syncOrderPayment(order: Order, payment: Payment): Promise<void> {
    await this.dependencies.orders.update({
      ...order,
      payment: this.orderPaymentProjection(payment),
      updatedAt: new Date().toISOString(),
    });
  }

  private async markValidationError(
    paymentId: string,
    reason: string,
    order: Order,
  ): Promise<void> {
    const result = await this.dependencies.payments.updateAtomically(
      paymentId,
      (current) => {
        const transition = transitionPaymentStatus(current.status, "error");
        if (!transition.allowed || !transition.changed) return current;
        return {
          ...current,
          status: "error",
          failureReason: reason,
          updatedAt: new Date().toISOString(),
        };
      },
    );
    if (result !== null) await this.syncOrderPayment(order, result.payment);
  }
}

export function createPaymentService(
  gateway: PaymentGateway = getPaymentGateway(),
): PaymentService {
  return new PaymentService({
    orders: getOrderRepository(),
    payments: getPaymentRepository(),
    gateway,
    orderPaidHandler: createFulfillmentOrderPaidHandler(),
  });
}

export async function findPaymentByOrderId(orderId: string): Promise<Payment | null> {
  return getPaymentRepository().findByOrderId(orderId);
}
