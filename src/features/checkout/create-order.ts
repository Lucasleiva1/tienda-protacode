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
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

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

/** Traducciones [inglés, portugués] de los problemas que devuelve el servicio de pedidos. */
const ORDER_PROBLEMS: Record<string, readonly [string, string]> = {
  empty_cart: ["Your cart is empty.", "Seu carrinho está vazio."],
  product_unavailable: [
    "One of the programs in your cart is no longer available. Check your cart before continuing.",
    "Um dos programas do seu carrinho não está mais disponível. Revise o carrinho antes de continuar.",
  ],
  mixed_currencies: [
    "The products in your cart use different currencies. Keep programs in a single currency to continue.",
    "Os produtos do carrinho usam moedas diferentes. Deixe programas de uma única moeda para continuar.",
  ],
  too_many_items: ["There are too many programs in your cart.", "Há programas demais no carrinho."],
  free_product: [
    "One of the programs in your cart is free and is downloaded from its page, without payment.",
    "Um dos programas do seu carrinho é gratuito e é baixado na página dele, sem pagamento.",
  ],
};

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
  const locale = await getLocale();
  const account = await getCurrentCustomerAccount();
  if (account === null) {
    return { ok: false, message: pick(locale, "Iniciá sesión para continuar con la compra.", "Sign in to continue with your purchase.", "Entre para continuar com a compra.") };
  }
  if (!account.emailVerified) {
    return { ok: false, message: pick(locale, "Confirmá tu email antes de continuar con la compra.", "Confirm your email before continuing with your purchase.", "Confirme seu e-mail antes de continuar com a compra.") };
  }

  const validacion = validateCheckout({
    ...input.values,
    firstName: account.firstName,
    lastName: account.lastName,
    email: account.email,
    confirmEmail: account.email,
  }, locale);
  if (!validacion.ok) {
    return { ok: false, errors: validacion.errors };
  }

  const whatsapp = await getWhatsAppConfiguration();
  if (whatsapp.requested && !whatsapp.ready) {
    return {
      ok: false,
      message: pick(locale, "La compra por WhatsApp todavía no está configurada. Probá nuevamente más tarde.", "WhatsApp purchases are not configured yet. Please try again later.", "A compra pelo WhatsApp ainda não está configurada. Tente novamente mais tarde."),
    };
  }

  const resultado = await createPendingOrder({
    customer: { ...validacion.customer, accountId: account.id },
    slugs: input.slugs,
    paymentProvider: whatsapp.requested ? "whatsapp" : null,
  });

  if (!resultado.ok) {
    const translated = ORDER_PROBLEMS[resultado.problem];
    return {
      ok: false,
      message:
        translated === undefined
          ? resultado.message
          : pick(locale, resultado.message, translated[0], translated[1]),
    };
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
