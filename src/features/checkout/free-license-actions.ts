"use server";

import { getCurrentCustomerAccount } from "@/features/accounts/customer-session";
import { createFulfillmentService } from "@/features/fulfillment/fulfillment-service";
import { createNotificationService } from "@/features/notifications/notification-service";
import { claimFreeLicenseOrder } from "@/features/orders/free-order-service";
import { getOrderReferenceRepository } from "@/features/orders/order-reference-repository";
import { getOrderRepository } from "@/features/orders/persistent-order-repository";
import { getPaymentRepository } from "@/features/payments/persistent-payment-repository";
import { getProductBySlug } from "@/features/products/queries";
import { getPurchaseAccessRepository } from "@/features/purchases/purchase-access-repository";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { allowPersistentRequest } from "@/lib/security/persistent-rate-limit";

export type FreeLicenseActionResult =
  | { readonly ok: true; readonly redirectTo: string }
  | { readonly ok: false; readonly message: string; readonly signInHref?: string };

/**
 * Programa gratuito con licencia: exige cuenta con email verificado y entrega una
 * sola licencia por cuenta. El navegador manda únicamente el slug.
 */
export async function claimFreeLicenseAction(slug: unknown): Promise<FreeLicenseActionResult> {
  const locale = await getLocale();
  if (typeof slug !== "string" || slug.length > 120) {
    return { ok: false, message: pick(locale, "Programa no encontrado.", "Program not found.", "Programa não encontrado.") };
  }

  const account = await getCurrentCustomerAccount();
  const next = `/programas/${encodeURIComponent(slug)}`;
  if (account === null) {
    return {
      ok: false,
      message: pick(locale, "Ingresá a tu cuenta para obtener la licencia gratuita.", "Sign in to get the free license.", "Entre na sua conta para obter a licença gratuita."),
      signInHref: `/cuenta/iniciar-sesion?next=${encodeURIComponent(next)}`,
    };
  }
  if (!account.emailVerified) {
    return {
      ok: false,
      message: pick(locale, "Confirmá tu email antes de obtener la licencia.", "Confirm your email before getting the license.", "Confirme seu e-mail antes de obter a licença."),
      signInHref: `/cuenta?verificacion=requerida&next=${encodeURIComponent(next)}`,
    };
  }
  if (!(await allowPersistentRequest("free-license", account.id, 10, 10 * 60_000))) {
    return { ok: false, message: pick(locale, "Demasiados intentos. Esperá unos minutos.", "Too many attempts. Wait a few minutes.", "Muitas tentativas. Aguarde alguns minutos.") };
  }

  const product = await getProductBySlug(slug);
  if (product === undefined) {
    return { ok: false, message: pick(locale, "Programa no encontrado.", "Program not found.", "Programa não encontrado.") };
  }

  const result = await claimFreeLicenseOrder(
    { account, product },
    {
      orders: getOrderRepository(),
      payments: getPaymentRepository(),
      access: getPurchaseAccessRepository(),
      references: getOrderReferenceRepository(),
      delivery: { deliver: (orderId) => createFulfillmentService().fulfill(orderId) },
      notifications: createNotificationService(),
    },
  );
  if (!result.ok || result.order.reference === null) {
    return {
      ok: false,
      message: pick(locale, "No pudimos preparar la licencia gratuita. Probá de nuevo en unos minutos.", "We could not prepare the free license. Please try again in a few minutes.", "Não foi possível preparar a licença gratuita. Tente novamente em alguns minutos."),
    };
  }
  return { ok: true, redirectTo: `/cuenta/compras/${encodeURIComponent(result.order.reference)}` };
}
