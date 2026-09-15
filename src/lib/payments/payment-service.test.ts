import assert from "node:assert/strict";
import test from "node:test";
import type { OrderPaidHandler } from "@/features/payments/order-paid-handler";
import { PaymentService } from "@/features/payments/payment-service";
import type {
  AtomicPaymentUpdate,
  PaymentRepository,
} from "@/features/payments/payment-repository";
import type { OrderRepository } from "@/features/orders/order-repository";
import { resolveApprovedPageState } from "@/features/payments/payment-page-state";
import { createDisabledPaymentGateway } from "@/lib/payments/disabled-payment-gateway";
import { createMockPaymentGateway } from "@/lib/payments/mock-payment-gateway";
import { PaymentGatewayError, type PaymentGateway } from "@/lib/payments/payment-gateway";
import type { Order } from "@/types/order";
import type { Payment, VerifiedPaymentEvent } from "@/types/payment";

const URLS = {
  successUrl: "/pago/aprobado",
  pendingUrl: "/pago/pendiente",
  failureUrl: "/pago/rechazado",
} as const;

function order(id = crypto.randomUUID()): Order {
  const now = new Date().toISOString();
  return {
    id,
    status: "pending",
    customer: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.test" },
    items: [
      {
        productId: "product-1",
        slug: "programa",
        appId: "programa-app",
        name: "Programa",
        version: "1.0.0",
        platforms: ["windows"],
        downloadType: "installer",
        unitPrice: { amount: 2490000, currency: "ARS" },
        quantity: 1,
        licenseStatus: "not_requested",
        licenseKey: null,
        issuedAt: null,
        licenseError: null,
        downloadFile: null,
        downloadEnabledAt: null,
      },
    ],
    currency: "ARS",
    subtotal: { amount: 2490000, currency: "ARS" },
    total: { amount: 2490000, currency: "ARS" },
    payment: {
      paymentId: null,
      status: "not_started",
      provider: null,
      providerReference: null,
    },
    licenseStatus: "not_requested",
    fulfillment: {
      status: "not_started",
      lastAttemptAt: null,
      completedAt: null,
      lastError: null,
    },
    purchaseAccess: null,
    createdAt: now,
    updatedAt: now,
  };
}

class MemoryOrderRepository implements OrderRepository {
  readonly name = "MemoryOrderRepository";
  readonly values = new Map<string, Order>();

  constructor(initial: readonly Order[] = []) {
    for (const value of initial) this.values.set(value.id, value);
  }

  async save(value: Order) { this.values.set(value.id, value); }
  async findById(id: string) { return this.values.get(id) ?? null; }
  async update(value: Order) { this.values.set(value.id, value); }
  async updateAtomically(id: string, updater: (current: Order) => Order) {
    const current = this.values.get(id);
    if (current === undefined) return null;
    const next = updater(current);
    this.values.set(id, next);
    return next;
  }
}

class MemoryPaymentRepository implements PaymentRepository {
  readonly name = "MemoryPaymentRepository";
  readonly values = new Map<string, Payment>();
  private readonly byOrder = new Map<string, string>();
  private readonly byExternal = new Map<string, string>();
  private readonly events = new Set<string>();

  async save(value: Payment) {
    this.values.set(value.id, value);
    this.byOrder.set(value.orderId, value.id);
    if (value.externalPaymentId !== null) {
      this.byExternal.set(`${value.provider}:${value.externalPaymentId}`, value.id);
    }
  }

  async saveIfAbsentForOrder(value: Payment) {
    const existingId = this.byOrder.get(value.orderId);
    if (existingId !== undefined) {
      return { payment: this.values.get(existingId)!, created: false };
    }
    await this.save(value);
    return { payment: value, created: true };
  }

  async findById(id: string) { return this.values.get(id) ?? null; }
  async findByOrderId(orderId: string) {
    const id = this.byOrder.get(orderId);
    return id === undefined ? null : this.values.get(id) ?? null;
  }
  async findByExternalPaymentId(provider: string, externalId: string) {
    const id = this.byExternal.get(`${provider}:${externalId}`);
    return id === undefined ? null : this.values.get(id) ?? null;
  }
  async update(value: Payment) { await this.save(value); }
  async updateAtomically(
    id: string,
    updater: (current: Payment) => Payment,
  ): Promise<AtomicPaymentUpdate | null> {
    const current = this.values.get(id);
    if (current === undefined) return null;
    const next = updater(current);
    const changed = JSON.stringify(next) !== JSON.stringify(current);
    if (changed) await this.save(next);
    return { payment: changed ? next : current, changed };
  }
  async claimWebhookEvent(provider: string, eventId: string) {
    const key = `${provider}:${eventId}`;
    if (this.events.has(key)) return false;
    this.events.add(key);
    return true;
  }
  async releaseWebhookEvent(provider: string, eventId: string) {
    this.events.delete(`${provider}:${eventId}`);
  }
}

class PendingGateway implements PaymentGateway {
  readonly provider = "test-provider";
  readonly name = "PendingGateway";
  readonly enabled = true;
  calls = 0;

  async createPayment(input: Parameters<PaymentGateway["createPayment"]>[0]) {
    this.calls += 1;
    return {
      provider: this.provider,
      externalPaymentId: `external-${input.orderId}`,
      checkoutUrl: input.pendingUrl,
      status: "pending" as const,
    };
  }
}

function setup(initialOrder = order()) {
  const orders = new MemoryOrderRepository([initialOrder]);
  const payments = new MemoryPaymentRepository();
  const gateway = new PendingGateway();
  let paidEffects = 0;
  const handler: OrderPaidHandler = {
    async handle() { paidEffects += 1; },
  };
  const service = new PaymentService({
    orders,
    payments,
    gateway,
    orderPaidHandler: handler,
  });
  return { initialOrder, orders, payments, gateway, service, paidEffects: () => paidEffects };
}

async function startedContext() {
  const context = setup();
  const result = await context.service.startPayment(context.initialOrder.id, URLS);
  assert.equal(result.ok, true);
  const payment = await context.payments.findByOrderId(context.initialOrder.id);
  assert.ok(payment);
  return { ...context, payment };
}

function eventFor(payment: Payment, overrides: Partial<VerifiedPaymentEvent> = {}): VerifiedPaymentEvent {
  return {
    provider: payment.provider,
    eventId: crypto.randomUUID(),
    externalPaymentId: payment.externalPaymentId!,
    orderId: payment.orderId,
    status: "approved",
    amount: payment.amount.amount,
    currency: payment.amount.currency,
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

test("provider none devuelve error controlado y no altera el pedido", async () => {
  const value = order();
  const orders = new MemoryOrderRepository([value]);
  const payments = new MemoryPaymentRepository();
  const service = new PaymentService({
    orders,
    payments,
    gateway: createDisabledPaymentGateway(),
  });

  const result = await service.startPayment(value.id, URLS);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "PAYMENT_PROVIDER_NOT_CONFIGURED");
  assert.equal((await orders.findById(value.id))?.status, "pending");
  assert.equal((await orders.findById(value.id))?.payment.status, "not_started");
  assert.equal(payments.values.size, 0);
});

test("doble startPayment reutiliza un único pago activo", async () => {
  const context = setup();
  const results = await Promise.all([
    context.service.startPayment(context.initialOrder.id, URLS),
    context.service.startPayment(context.initialOrder.id, URLS),
  ]);
  assert.equal(results.every((result) => result.ok), true);
  assert.equal(context.gateway.calls, 1);
  assert.equal(context.payments.values.size, 1);
});

test("evento approved válido deja Order paid, Payment approved y licencia sin solicitar", async () => {
  const context = await startedContext();
  const result = await context.service.processVerifiedEvent(eventFor(context.payment));
  assert.equal(result.ok, true);
  assert.equal((await context.orders.findById(context.initialOrder.id))?.status, "paid");
  assert.equal((await context.payments.findById(context.payment.id))?.status, "approved");
  assert.equal((await context.orders.findById(context.initialOrder.id))?.licenseStatus, "not_requested");
  assert.equal(context.paidEffects(), 1);
});

test("evento duplicado es idempotente y no repite el efecto ORDER_PAID", async () => {
  const context = await startedContext();
  const event = eventFor(context.payment);
  await context.service.processVerifiedEvent(event);
  const duplicate = await context.service.processVerifiedEvent(event);
  assert.equal(duplicate.ok, true);
  if (duplicate.ok) assert.equal(duplicate.duplicate, true);
  assert.equal(context.paidEffects(), 1);
});

test("amount incorrecto bloquea aprobación", async () => {
  const context = await startedContext();
  const result = await context.service.processVerifiedEvent(
    eventFor(context.payment, { amount: context.payment.amount.amount - 1 }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "PAYMENT_AMOUNT_MISMATCH");
  assert.equal((await context.orders.findById(context.initialOrder.id))?.status, "pending");
  assert.equal((await context.payments.findById(context.payment.id))?.status, "error");
});

test("currency incorrecta bloquea aprobación", async () => {
  const context = await startedContext();
  const result = await context.service.processVerifiedEvent(
    eventFor(context.payment, { currency: "USD" }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "PAYMENT_CURRENCY_MISMATCH");
  assert.equal((await context.orders.findById(context.initialOrder.id))?.status, "pending");
});

test("pedido inexistente rechaza el evento con seguridad", async () => {
  const context = await startedContext();
  const result = await context.service.processVerifiedEvent(
    eventFor(context.payment, { orderId: crypto.randomUUID() }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "ORDER_NOT_FOUND");
});

test("evento rejected deja pago rechazado y pedido fallido", async () => {
  const context = await startedContext();
  const result = await context.service.processVerifiedEvent(
    eventFor(context.payment, { status: "rejected" }),
  );
  assert.equal(result.ok, true);
  assert.equal((await context.payments.findById(context.payment.id))?.status, "rejected");
  assert.equal((await context.orders.findById(context.initialOrder.id))?.status, "failed");
  assert.equal(context.paidEffects(), 0);
});

test("un pedido cancelado nunca pasa a paid", async () => {
  const context = await startedContext();
  const cancelled = { ...context.initialOrder, status: "cancelled" as const };
  await context.orders.update(cancelled);
  const result = await context.service.processVerifiedEvent(eventFor(context.payment));
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "ORDER_STATE_TRANSITION_NOT_ALLOWED");
  assert.equal((await context.orders.findById(cancelled.id))?.status, "cancelled");
  assert.equal(context.paidEffects(), 0);
});

test("la página aprobada se decide por Order y no por la URL", () => {
  assert.equal(resolveApprovedPageState("pending"), "confirming");
  assert.equal(resolveApprovedPageState("paid"), "confirmed");
  assert.equal(resolveApprovedPageState("fulfilled"), "confirmed");
  assert.equal(resolveApprovedPageState("failed"), "rejected");
  assert.equal(resolveApprovedPageState(null), "missing");
});

test("MockPaymentGateway está prohibido en production", () => {
  assert.throws(
    () => createMockPaymentGateway("production"),
    (error) =>
      error instanceof PaymentGatewayError &&
      error.code === "PAYMENT_MOCK_FORBIDDEN_IN_PRODUCTION",
  );
});
