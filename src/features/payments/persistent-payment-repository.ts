import "server-only";
import type {
  AtomicPaymentUpdate,
  PaymentRepository,
} from "@/features/payments/payment-repository";
import { getKeyValueStore, STORES, type KeyValueStore } from "@/lib/storage/store";
import type { Payment } from "@/types/payment";

const paymentKey = (id: string) => `payment:${id}`;
const orderKey = (orderId: string) => `order:${orderId}`;
const externalKey = (provider: string, externalId: string) =>
  `external:${provider}:${externalId}`;
const eventKey = (provider: string, eventId: string) => `webhook:${provider}:${eventId}`;

async function indexExternal(store: KeyValueStore, payment: Payment): Promise<void> {
  if (payment.externalPaymentId === null) return;
  const key = externalKey(payment.provider, payment.externalPaymentId);
  const created = await store.setIfAbsent(key, payment.id);
  if (created) return;

  const existing = await store.get<string>(key);
  if (existing !== payment.id) throw new Error("PAYMENT_EXTERNAL_ID_CONFLICT");
}

export function createPersistentPaymentRepository(
  store = getKeyValueStore(STORES.payments),
): PaymentRepository {
  return {
    name: `PaymentRepository (${store.engine})`,

    async save(payment) {
      await indexExternal(store, payment);
      await store.set(paymentKey(payment.id), payment);
      await store.set(orderKey(payment.orderId), payment.id);
    },

    async saveIfAbsentForOrder(payment) {
      const key = paymentKey(payment.id);
      const created = await store.setIfAbsent(key, payment);
      await store.setIfAbsent(orderKey(payment.orderId), payment.id);
      if (created) return { payment, created: true };

      const existing = await store.get<Payment>(key);
      if (existing === null) throw new Error("PAYMENT_IDEMPOTENCY_RECORD_MISSING");
      return { payment: existing, created: false };
    },

    async findById(id) {
      return store.get<Payment>(paymentKey(id));
    },

    async findByOrderId(orderId) {
      const id = await store.get<string>(orderKey(orderId));
      if (id !== null) return store.get<Payment>(paymentKey(id));
      return store.get<Payment>(paymentKey(`pay-${orderId}`));
    },

    async findByExternalPaymentId(provider, externalId) {
      const id = await store.get<string>(externalKey(provider, externalId));
      return id === null ? null : store.get<Payment>(paymentKey(id));
    },

    async update(payment) {
      await indexExternal(store, payment);
      await store.set(paymentKey(payment.id), payment);
      await store.set(orderKey(payment.orderId), payment.id);
    },

    async updateAtomically(id, updater): Promise<AtomicPaymentUpdate | null> {
      const key = paymentKey(id);

      for (let intento = 0; intento < 5; intento += 1) {
        const current = await store.getWithVersion<Payment>(key);
        if (current === null) return null;

        const next = updater(current.value);
        if (JSON.stringify(next) === JSON.stringify(current.value)) {
          return { payment: current.value, changed: false };
        }

        await indexExternal(store, next);
        if (await store.setIfVersion(key, next, current.version)) {
          return { payment: next, changed: true };
        }
      }

      throw new Error("PAYMENT_CONCURRENT_UPDATE_RETRY_EXHAUSTED");
    },

    async claimWebhookEvent(provider, eventId, paymentId) {
      return store.setIfAbsent(eventKey(provider, eventId), {
        paymentId,
        receivedAt: new Date().toISOString(),
      });
    },

    async releaseWebhookEvent(provider, eventId) {
      await store.remove(eventKey(provider, eventId));
    },
  };
}

let repository: PaymentRepository | null = null;

export function getPaymentRepository(): PaymentRepository {
  if (repository === null) repository = createPersistentPaymentRepository();
  return repository;
}
