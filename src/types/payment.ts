import type { Currency, Money } from "@/types/product";

/** Estados internos y normalizados de un pago. */
export const PAYMENT_STATUSES = [
  "not_started",
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "refunded",
  "error",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Estados que puede comunicar un webhook ya verificado por su adapter. */
export type ProviderPaymentStatus = Exclude<PaymentStatus, "not_started" | "error">;

/**
 * Intento de pago persistido.
 *
 * El importe es una copia del total congelado del pedido. Nunca se construye con
 * valores recibidos del navegador.
 */
export interface Payment {
  readonly id: string;
  readonly orderId: string;
  readonly provider: string;
  readonly externalPaymentId: string | null;
  readonly status: PaymentStatus;
  readonly amount: Money;
  readonly checkoutUrl: string | null;
  readonly idempotencyKey: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly approvedAt: string | null;
  readonly failureReason: string | null;
}

/** Evento que un adapter ya autenticó y normalizó. */
export interface VerifiedPaymentEvent {
  readonly provider: string;
  readonly eventId: string;
  readonly externalPaymentId: string;
  readonly orderId: string;
  readonly status: ProviderPaymentStatus;
  /** Unidad mínima de la moneda (centavos). */
  readonly amount: number;
  readonly currency: Currency;
  readonly occurredAt: string;
}
