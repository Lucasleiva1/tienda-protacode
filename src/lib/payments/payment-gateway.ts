import type { Currency } from "@/types/product";
import type { VerifiedPaymentEvent } from "@/types/payment";

export type PaymentGatewayErrorCode =
  | "PAYMENT_PROVIDER_NOT_CONFIGURED"
  | "PAYMENT_PROVIDER_UNKNOWN"
  | "PAYMENT_MOCK_FORBIDDEN_IN_PRODUCTION"
  | "PAYMENT_PROVIDER_ERROR"
  | "PAYMENT_WEBHOOK_NOT_SUPPORTED"
  | "PAYMENT_WEBHOOK_INVALID";

export class PaymentGatewayError extends Error {
  constructor(
    readonly code: PaymentGatewayErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PaymentGatewayError";
  }
}

export interface CreatePaymentInput {
  readonly orderId: string;
  /** Importe en la unidad mínima de la moneda (centavos). */
  readonly amount: number;
  readonly currency: Currency;
  readonly customerEmail: string;
  readonly description: string;
  readonly successUrl: string;
  readonly pendingUrl: string;
  readonly failureUrl: string;
  readonly idempotencyKey: string;
}

export interface CreatePaymentResult {
  readonly provider: string;
  readonly externalPaymentId: string;
  readonly checkoutUrl: string;
  /** Crear un pago nunca puede aprobarlo: la confirmación llega verificada después. */
  readonly status: "pending";
}

/** Puerto pequeño y neutral que implementará cada proveedor futuro. */
export interface PaymentGateway {
  readonly provider: string;
  readonly name: string;
  readonly enabled: boolean;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  getPaymentStatus?(externalPaymentId: string): Promise<VerifiedPaymentEvent>;
  /** El adapter recibe el Request sin consumir para poder verificar la firma real. */
  verifyWebhook?(request: Request): Promise<VerifiedPaymentEvent>;
}
