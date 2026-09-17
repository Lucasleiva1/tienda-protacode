"use server";

import { isAdmin, NO_AUTORIZADO } from "@/features/admin/guard";
import { createNotificationService } from "@/features/notifications/notification-service";
import {
  getPushSubscriptionRepository,
  parsePushSubscription,
} from "@/features/notifications/push-subscription-repository";
import { getPushConfiguration } from "@/lib/push/web-push-sender";
import { allowRequest } from "@/lib/security/rate-limit";

export type PushActionResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly message: string };

/** Guarda este dispositivo para recibir los avisos de pagos informados. */
export async function savePushSubscriptionAction(
  subscription: unknown,
  deviceLabel: unknown,
): Promise<PushActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  if (!getPushConfiguration().ready) {
    return { ok: false, message: "Faltan las claves VAPID en el servidor." };
  }
  const parsed = parsePushSubscription(subscription);
  if (parsed === null) {
    return { ok: false, message: "El navegador devolvió una suscripción que no es válida." };
  }
  const label =
    typeof deviceLabel === "string" && deviceLabel.trim() !== ""
      ? deviceLabel.trim().replace(/\s+/g, " ")
      : "Dispositivo";
  try {
    await getPushSubscriptionRepository().save(parsed, label);
  } catch {
    return { ok: false, message: "Se alcanzó el máximo de dispositivos. Desactivá alguno antes." };
  }
  return { ok: true, message: "Notificaciones activadas en este dispositivo." };
}

export async function removePushSubscriptionAction(endpoint: unknown): Promise<PushActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  if (typeof endpoint !== "string" || endpoint.length > 1024) {
    return { ok: false, message: "Suscripción no válida." };
  }
  await getPushSubscriptionRepository().remove(endpoint);
  return { ok: true, message: "Notificaciones desactivadas en este dispositivo." };
}

export async function sendTestPushAction(): Promise<PushActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  if (!allowRequest("admin-push-test", "single-admin", 5, 60_000)) {
    return { ok: false, message: "Esperá un minuto antes de enviar otra prueba." };
  }
  const summary = await createNotificationService().sendAdminTest();
  if (!summary.configured) return { ok: false, message: "Faltan las claves VAPID en el servidor." };
  if (summary.devices === 0) return { ok: false, message: "No hay dispositivos activados." };
  return {
    ok: summary.sent > 0,
    message: `Prueba enviada a ${summary.sent} de ${summary.devices} dispositivo(s)${summary.removed > 0 ? `; se quitaron ${summary.removed} vencido(s)` : ""}.`,
  };
}
