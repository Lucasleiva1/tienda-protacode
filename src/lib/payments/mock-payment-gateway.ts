import "server-only";
import {
  PaymentGatewayError,
  type CreatePaymentInput,
  type CreatePaymentResult,
  type PaymentGateway,
} from "@/lib/payments/payment-gateway";

/** Adapter de desarrollo y tests. Solo crea estados pendientes y no puede aprobar. */
export function createMockPaymentGateway(
  environment = process.env.NODE_ENV,
): PaymentGateway {
  if (environment === "production") {
    throw new PaymentGatewayError(
      "PAYMENT_MOCK_FORBIDDEN_IN_PRODUCTION",
      "MockPaymentGateway está prohibido en producción.",
    );
  }

  return {
    provider: "mock",
    name: "MockPaymentGateway (solo desarrollo/tests)",
    enabled: true,

    async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
      return {
        provider: "mock",
        externalPaymentId: `mock-${input.orderId}`,
        checkoutUrl: input.pendingUrl,
        status: "pending",
      };
    },
  };
}
