import type { Payment } from "@/types/payment";

export interface AtomicPaymentUpdate {
  readonly payment: Payment;
  readonly changed: boolean;
}

export interface PaymentRepository {
  readonly name: string;
  save(payment: Payment): Promise<void>;
  saveIfAbsentForOrder(payment: Payment): Promise<{ payment: Payment; created: boolean }>;
  findById(id: string): Promise<Payment | null>;
  findByOrderId(orderId: string): Promise<Payment | null>;
  findByExternalPaymentId(provider: string, externalId: string): Promise<Payment | null>;
  update(payment: Payment): Promise<void>;
  updateAtomically(
    id: string,
    updater: (current: Payment) => Payment,
  ): Promise<AtomicPaymentUpdate | null>;
  claimWebhookEvent(provider: string, eventId: string, paymentId: string): Promise<boolean>;
  releaseWebhookEvent(provider: string, eventId: string): Promise<void>;
}
