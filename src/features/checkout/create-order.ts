"use server";

import {
  validateCheckout,
  type CheckoutErrors,
  type CheckoutFormValues,
} from "@/features/checkout/checkout-validation";
import { createPendingOrder } from "@/features/orders/order-service";
import { startPaymentAction } from "@/features/payments/start-payment";
import { setPurchaseAccessCookie } from "@/features/purchases/purchase-cookie";
import {
  buildWhatsAppCheckoutUrl,
  getWhatsAppConfiguration,
} from "@/features/checkout/whatsapp";
import { getCurrentCustomerAccount } from "@/features/accounts/customer-session";

export type CreateOrderActionResult =
  | {
      readonly ok: true;
      readonly orderId: string;
      readonly checkoutUrl: string | null;
      readonly paymentState: "whatsapp" | "pending" | "not_configured" | "error";
    }
  | {
      readonly ok: false;
      readonly errors?: CheckoutErrors;
      readonly message?: string;
    };

export interface CreateOrderActionInput {
  readonly values: CheckoutFormValues;
  /** Identificadores del carrito. Lo único que se acepta del navegador. */
  readonly slugs: readonly string[];
}

/**
 * Crea el pedido.
 *
 * Corre en el servidor. Vuelve a validar TODO aunque el formulario ya haya validado:
 * la validación del navegador es una comodidad, no una barrera, y se puede saltear.
 *
 * Del navegador se aceptan dos cosas y nada más: los datos del comprador y una lista
 * de slugs. Precios, nombres, versiones, appId, moneda y totales se calculan en el
 * servidor leyendo los productos publicados.
 */
export async function createOrderAction(
  input: CreateOrderActionInput,
): Promise<CreateOrderActionResult> {
  const account = await getCurrentCustomerAccount();
  if (account === null) {
    return { ok: false, message: "Iniciá sesión para continuar con la compra." };
  }
  if (!account.emailVerified) {
    return { ok: false, message: "Confirmá tu email antes de continuar con la compra." };
  }

  const validacion = validateCheckout({
    ...input.values,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    confirmEmail: account.email,
  });
  if (!validacion.ok) {
    return { ok: false, errors: validacion.errors };
  }

  const whatsapp = await getWhatsAppConfiguration();
  if (whatsapp.requested && !whatsapp.ready) {
    return {
      ok: false,
      message: "La compra por WhatsApp todavía no está configurada. Probá nuevamente más tarde.",
    };
  }

  const resultado = await createPendingOrder({
    customer: { ...validacion.customer, accountId: account.id },
    slugs: input.slugs,
    paymentProvider: whatsapp.requested ? "whatsapp" : null,
  });

  if (!resultado.ok) {
    return { ok: false, message: resultado.message };
  }

  // El token plano vive en una cookie HttpOnly; el pedido conserva únicamente SHA-256.
  await setPurchaseAccessCookie(resultado.purchaseToken);

  if (whatsapp.requested && whatsapp.number !== null) {
    return {
      ok: true,
      orderId: resultado.order.id,
      checkoutUrl: buildWhatsAppCheckoutUrl(resultado.order, whatsapp.number),
      paymentState: "whatsapp",
    };
  }

  const payment = await startPaymentAction(resultado.order.id);
  if (payment.ok) {
    return {
      ok: true,
      orderId: resultado.order.id,
      checkoutUrl: payment.checkoutUrl,
      paymentState: "pending",
    };
  }

  const notConfigured = [
    "PAYMENT_PROVIDER_NOT_CONFIGURED",
    "PAYMENT_PROVIDER_UNKNOWN",
    "PAYMENT_MOCK_FORBIDDEN_IN_PRODUCTION",
  ].includes(payment.code);

  // El pedido no se destruye si el provider no está disponible.
  return {
    ok: true,
    orderId: resultado.order.id,
    checkoutUrl: null,
    paymentState: notConfigured ? "not_configured" : "error",
  };
}
