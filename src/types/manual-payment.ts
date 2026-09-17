/**
 * Pagos manuales: Prex, Ualá, transferencia/QR y WhatsApp.
 *
 * El comprador informa que pagó y el administrador verifica el ingreso a mano. Un
 * aviso del comprador NUNCA aprueba un pago: solo el Admin, desde el servidor, puede
 * pasar el pedido a `paid`.
 */

import type { ProductImage } from "@/types/product";

/** Medios fijos. El nombre visible, el alias y el QR se editan desde el Admin. */
export const MANUAL_PAYMENT_METHOD_IDS = ["prex", "uala", "transfer", "whatsapp"] as const;

export type ManualPaymentMethodId = (typeof MANUAL_PAYMENT_METHOD_IDS)[number];

/**
 * Estado del pago manual.
 *
 * pending               → el pedido existe y todavía no se informó el pago
 * awaiting_verification → el comprador tocó "Ya pagué"; falta la verificación
 * paid                  → el Admin verificó el ingreso y lo confirmó
 * rejected              → el Admin no encontró el ingreso y lo rechazó
 *
 * `paid` y `rejected` son finales: no se vuelve atrás desde ninguno de los dos.
 */
export const MANUAL_PAYMENT_STATUSES = [
  "pending",
  "awaiting_verification",
  "paid",
  "rejected",
] as const;

export type ManualPaymentStatus = (typeof MANUAL_PAYMENT_STATUSES)[number];

/** Comprobante privado. Es evidencia auxiliar: jamás aprueba un pago por sí solo. */
export interface PaymentProofReference {
  /** Clave interna en `prota-code-payment-proofs`. Nunca se muestra al comprador. */
  readonly storageKey: string;
  readonly contentType: string;
  readonly size: number;
  readonly sha256: string;
  /** ISO 8601 en UTC. */
  readonly uploadedAt: string;
}

/** Bloque de pago manual dentro del pedido. Se actualiza siempre con CAS. */
export interface OrderManualPayment {
  readonly status: ManualPaymentStatus;
  /** `null` mientras el comprador no eligió medio. */
  readonly method: ManualPaymentMethodId | null;
  /** Nombre visible del medio en el momento de elegirlo. */
  readonly methodLabel: string | null;
  readonly methodSelectedAt: string | null;
  /** Momento en que el comprador tocó "Ya pagué". */
  readonly reportedAt: string | null;
  readonly proof: PaymentProofReference | null;
  /** Momento en que el Admin confirmó el ingreso. */
  readonly paidAt: string | null;
  readonly approvedBy: string | null;
  readonly rejectedAt: string | null;
  readonly rejectedBy: string | null;
  /** Texto breve que escribió el Admin. Se muestra al comprador. */
  readonly rejectionReason: string | null;
}

/** Configuración pública de un medio de pago, administrada desde el panel. */
export interface PaymentMethodSettings {
  readonly id: ManualPaymentMethodId;
  /** "transfer": alias, CVU y QR. "whatsapp": abre una conversación. */
  readonly kind: "transfer" | "whatsapp";
  readonly name: string;
  readonly active: boolean;
  readonly alias: string | null;
  readonly cvu: string | null;
  readonly holder: string | null;
  readonly instructions: string | null;
  readonly qr: ProductImage | null;
  readonly updatedAt: string | null;
}
