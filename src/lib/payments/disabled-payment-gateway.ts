import "server-only";
import {
  PaymentGatewayError,
  type CreatePaymentInput,
  type PaymentGateway,
  type PaymentGatewayErrorCode,
} from "@/lib/payments/payment-gateway";

export function createDisabledPaymentGateway(
  code: PaymentGatewayErrorCode = "PAYMENT_PROVIDER_NOT_CONFIGURED",
  message = "El medio de pago todavía no está configurado.",
): PaymentGateway {
  return {
    provider: "none",
    name: "DisabledPaymentGateway",
    enabled: false,

    async createPayment(input: CreatePaymentInput): Promise<never> {
      void input;
      throw new PaymentGatewayError(code, message);
    },
  };
}
