"use server";

import {
  validateCheckout,
  type CheckoutErrors,
  type CheckoutFormValues,
} from "@/features/checkout/checkout-validation";
import { getCurrentCustomerAccount } from "@/features/accounts/customer-session";
import { createNotificationService } from "@/features/notifications/notification-service";
import { createPendingOrder } from "@/features/orders/order-service";
import { startPaymentAction } from "@/features/payments/start-payment";
import { setPurchaseAccessCookie } from "@/features/purchases/purchase-cookie";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { getPaymentConfiguration } from "@/lib/payments/gateway-registry";
import { paymentLog } from "@/lib/payments/payment-logger";
import { getClientIp } from "@/lib/security/client-ip";
import { allowPersistentRequest } from "@/lib/security/persistent-rate-limit";

export type CreateOrderActionResult =
  | {
      readonly ok: true;
      readonly orderId: string;
      readonly reference: string | null;
      /** A dónde sigue el comprador: su pedido o la pasarela. */
      readonly checkoutUrl: string | null;
      readonly paymentState: "manual" | "pending" | "not_configured" | "error";
      /** `false` cuando no se pudo enviar el email con el enlace privado. */
      readonly emailSent: boolean;
    }
  | {
      readonly ok: false;
      readonly errors?: CheckoutErrors;
      readonly message?: string;
    };

export interface CreateOrderActionInput {
  readonly values: CheckoutFormValues;
  /** Identificadores de programa. Lo único del carrito que se acepta del navegador. */
  readonly slugs: readonly string[];
  /** "account": compra asociada a la sesión. "guest": compra como invitado. */
  readonly mode: "account" | "guest";
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
  invalid_total: [
    "This program does not have a valid price yet. Please try later.",
    "Este programa ainda não tem um preço válido. Tente mais tarde.",
  ],
};

function readValues(value: unknown): CheckoutFormValues {
  const source = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const text = (key: string) => (typeof source[key] === "string" ? (source[key] as string).slice(0, 300) : "");
  return {
    firstName: text("firstName"),
    lastName: text("lastName"),
    email: text("email"),
    confirmEmail: text("confirmEmail"),
    whatsapp: text("whatsapp"),
    acceptedTerms: source.acceptedTerms === true,
  };
}

/**
 * Crea el pedido.
 *
 * Corre en el servidor y vuelve a validar TODO. Del navegador se aceptan solo los
 * datos del comprador y una lista de slugs: precios, nombres, versiones, moneda y
 * totales se calculan acá. La cuenta sale de la sesión, nunca de un id enviado por
 * el navegador: con sesión verificada la compra queda asociada a esa cuenta y se usa
 * su email, aunque el formulario mande otro.
 */
export async function createOrderAction(
  input: CreateOrderActionInput,
): Promise<CreateOrderActionResult> {
  const locale = await getLocale();
  const values = readValues(input?.values);
  const slugs = Array.isArray(input?.slugs)
    ? input.slugs.filter((slug): slug is string => typeof slug === "string").slice(0, 50)
    : [];

  const account = await getCurrentCustomerAccount();
  const useAccount = account !== null && account.emailVerified;

  if (input?.mode === "account" && !useAccount) {
    return {
      ok: false,
      message:
        account === null
          ? pick(locale, "Tu sesión venció. Volvé a ingresar o continuá como invitado.", "Your session expired. Sign in again or continue as a guest.", "Sua sessão expirou. Entre novamente ou continue como convidado.")
          : pick(locale, "Confirmá tu email para asociar la compra a tu cuenta, o continuá como invitado.", "Confirm your email to link the purchase to your account, or continue as a guest.", "Confirme seu e-mail para vincular a compra à sua conta, ou continue como convidado."),
    };
  }

  const validation = validateCheckout(
    useAccount
      ? {
          ...values,
          firstName: account.firstName,
          lastName: account.lastName,
          email: account.email,
          confirmEmail: account.email,
        }
      : values,
    locale,
  );
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const limiterKey = useAccount ? `account:${account.id}` : `ip:${await getClientIp()}`;
  if (!(await allowPersistentRequest("create-order", limiterKey, 8, 10 * 60_000))) {
    return {
      ok: false,
      message: pick(locale, "Creaste varios pedidos seguidos. Esperá unos minutos antes de volver a intentar.", "You created several orders in a row. Wait a few minutes before trying again.", "Você criou vários pedidos seguidos. Aguarde alguns minutos antes de tentar novamente."),
    };
  }

  const gateway = getPaymentConfiguration();
  const paymentMode = gateway.ready ? "gateway" : "manual";

  const result = await createPendingOrder({
    customer: { ...validation.customer, accountId: useAccount ? account.id : null },
    slugs,
    paymentMode,
  });

  if (!result.ok) {
    const translated = ORDER_PROBLEMS[result.problem];
    return {
      ok: false,
      message:
        translated === undefined
          ? result.message
          : pick(locale, result.message, translated[0], translated[1]),
    };
  }

  // El token plano vive en una cookie HttpOnly; el pedido conserva únicamente SHA-256.
  await setPurchaseAccessCookie(result.purchaseToken);
  paymentLog("info", "ORDER_CREATED", {
    orderId: result.order.id,
    reference: result.order.reference,
    mode: paymentMode,
    guest: !useAccount,
  });

  if (paymentMode === "manual") {
    let emailSent = false;
    try {
      emailSent =
        (await createNotificationService().orderCreated(result.order, result.purchaseToken)) === "sent";
    } catch {
      emailSent = false;
    }
    return {
      ok: true,
      orderId: result.order.id,
      reference: result.order.reference,
      checkoutUrl:
        useAccount && result.order.reference !== null
          ? `/cuenta/compras/${encodeURIComponent(result.order.reference)}`
          : `/compras/${encodeURIComponent(result.purchaseToken)}`,
      paymentState: "manual",
      emailSent,
    };
  }

  const payment = await startPaymentAction(result.order.id);
  if (payment.ok) {
    return {
      ok: true,
      orderId: result.order.id,
      reference: result.order.reference,
      checkoutUrl: payment.checkoutUrl,
      paymentState: "pending",
      emailSent: false,
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
    orderId: result.order.id,
    reference: result.order.reference,
    checkoutUrl: null,
    paymentState: notConfigured ? "not_configured" : "error",
    emailSent: false,
  };
}
