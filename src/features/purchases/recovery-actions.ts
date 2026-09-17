"use server";

import { normalizarEmail } from "@/features/checkout/checkout-validation";
import { createNotificationService } from "@/features/notifications/notification-service";
import { findOrder } from "@/features/orders/order-service";
import { normalizeOrderReference } from "@/features/orders/order-reference-repository";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";
import { getEmailConfiguration } from "@/lib/email/mailer";
import { getClientIp } from "@/lib/security/client-ip";
import { allowPersistentRequest } from "@/lib/security/persistent-rate-limit";

export interface RecoveryState {
  readonly ok: boolean | null;
  readonly message: string;
}

/**
 * Recupera el enlace privado de una compra hecha como invitado.
 *
 * El enlace se envía SOLO al email del pedido, y la respuesta es la misma haya o no
 * coincidencia: así nadie puede averiguar qué pedidos existen ni de quién son.
 */
export async function requestOrderAccessEmailAction(
  _previous: RecoveryState,
  formData: FormData,
): Promise<RecoveryState> {
  const locale = await getLocale();
  const email = normalizarEmail(String(formData.get("email") ?? "")).slice(0, 254);
  const reference = normalizeOrderReference(String(formData.get("reference") ?? "").slice(0, 20));

  if (!getEmailConfiguration().ready) {
    return {
      ok: false,
      message: pick(locale, "El envío de emails no está disponible todavía. Escribinos por WhatsApp con tu número de pedido.", "Email delivery is not available yet. Contact us on WhatsApp with your order number.", "O envio de e-mails ainda não está disponível. Fale conosco pelo WhatsApp com o número do pedido."),
    };
  }

  const ip = await getClientIp();
  const [ipAllowed, emailAllowed] = await Promise.all([
    allowPersistentRequest("order-recovery-ip", ip, 6, 15 * 60_000),
    allowPersistentRequest("order-recovery-email", email || "empty", 3, 15 * 60_000),
  ]);
  if (!ipAllowed || !emailAllowed) {
    return {
      ok: false,
      message: pick(locale, "Demasiados intentos. Esperá 15 minutos.", "Too many attempts. Wait 15 minutes.", "Muitas tentativas. Aguarde 15 minutos."),
    };
  }

  if (reference !== null && email !== "") {
    const order = await findOrder(reference);
    if (order !== null && normalizarEmail(order.customer.email) === email) {
      await createNotificationService().sendAccessLink(order).catch(() => "failed");
    }
  }

  return {
    ok: true,
    message: pick(locale, "Si los datos coinciden con una compra, te enviamos el enlace privado a ese email. Revisá también correo no deseado.", "If the details match a purchase, we sent the private link to that email. Check your spam folder too.", "Se os dados corresponderem a uma compra, enviamos o link privado para esse e-mail. Verifique também a caixa de spam."),
  };
}
