import "server-only";
import { createDisabledPaymentGateway } from "@/lib/payments/disabled-payment-gateway";
import { createMockPaymentGateway } from "@/lib/payments/mock-payment-gateway";
import type { PaymentGateway } from "@/lib/payments/payment-gateway";

export interface PaymentConfiguration {
  readonly requestedProvider: string;
  readonly activeProvider: string | null;
  readonly ready: boolean;
  readonly label: string;
  readonly message: string;
}

function configuredName(): string {
  return (process.env.PAYMENT_PROVIDER ?? "none").trim().toLowerCase() || "none";
}

export function getPaymentConfiguration(): PaymentConfiguration {
  const requestedProvider = configuredName();

  if (requestedProvider === "none") {
    return {
      requestedProvider,
      activeProvider: null,
      ready: false,
      label: "No configurado",
      message: "El medio de pago todavía no está configurado.",
    };
  }

  if (requestedProvider === "mock") {
    const ready = process.env.NODE_ENV !== "production";
    return {
      requestedProvider,
      activeProvider: ready ? "mock" : null,
      ready,
      label: ready ? "Mock (solo desarrollo/tests)" : "No configurado",
      message: ready
        ? "Adapter de prueba activo. Nunca aprueba pagos por sí mismo."
        : "MockPaymentGateway está prohibido en producción.",
    };
  }

  return {
    requestedProvider,
    activeProvider: null,
    ready: false,
    label: "No configurado",
    message: `El provider “${requestedProvider}” no está registrado.`,
  };
}

/** Único punto que resuelve el adapter activo. La UI nunca importa adapters. */
export function getPaymentGateway(): PaymentGateway {
  const config = getPaymentConfiguration();

  if (config.requestedProvider === "mock") {
    if (process.env.NODE_ENV === "production") {
      return createDisabledPaymentGateway(
        "PAYMENT_MOCK_FORBIDDEN_IN_PRODUCTION",
        config.message,
      );
    }
    return createMockPaymentGateway();
  }

  if (config.requestedProvider !== "none") {
    return createDisabledPaymentGateway("PAYMENT_PROVIDER_UNKNOWN", config.message);
  }

  return createDisabledPaymentGateway();
}

/** Hoy no hay ningún proveedor real registrado. */
export function getRegisteredPaymentGateway(provider: string): PaymentGateway | null {
  const normalized = provider.trim().toLowerCase();
  if (normalized !== "mock" || process.env.NODE_ENV === "production") return null;
  return createMockPaymentGateway();
}
