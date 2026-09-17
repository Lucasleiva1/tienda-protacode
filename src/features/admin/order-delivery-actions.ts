"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, NO_AUTORIZADO } from "@/features/admin/guard";
import { getAdminEnv } from "@/features/admin/session";
import { createLicenseService } from "@/features/licensing/license-service";
import { createNotificationService } from "@/features/notifications/notification-service";
import { adminOrderPath } from "@/features/orders/order-display";
import { findOrder } from "@/features/orders/order-service";
import { createManualPaymentService } from "@/features/payments/manual-payment-factory";
import { rotatePurchaseAccess } from "@/features/purchases/purchase-access";
import { allowRequest } from "@/lib/security/rate-limit";
import type { Order } from "@/types/order";

export type AdminDeliveryActionResult =
  | { readonly ok: true; readonly message: string; readonly purchasePath?: string }
  | { readonly ok: false; readonly message: string };

/** Quién aprueba: el Admin es único y se identifica por su email configurado. */
function adminActor(): string {
  return getAdminEnv()?.email ?? "admin";
}

function refreshOrderViews(order: Pick<Order, "id" | "reference">): void {
  revalidatePath("/admin");
  revalidatePath("/admin/pedidos");
  revalidatePath(adminOrderPath(order));
}

/**
 * CONFIRMAR PAGO. Solo servidor, solo con sesión de Admin.
 *
 * La idempotencia vive en el servicio: dos clics, una recarga o un reintento por
 * mala conexión devuelven el mismo resultado y no generan otra licencia.
 */
export async function confirmPaymentAction(orderId: string): Promise<AdminDeliveryActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  if (typeof orderId !== "string" || !allowRequest("admin-confirm-payment", orderId, 10, 60_000)) {
    return { ok: false, message: "Esperá un minuto antes de volver a intentar." };
  }
  const order = await findOrder(orderId);
  if (order === null) return { ok: false, message: "No encontramos el pedido." };

  const result = await createManualPaymentService().confirmPayment(order.id, adminActor());
  refreshOrderViews(order);
  if (!result.ok) return { ok: false, message: result.message };

  const delivered = result.order.status === "fulfilled";
  const prefix = result.duplicate
    ? "Este pago ya estaba confirmado; no se repitió nada."
    : "Pago confirmado.";
  const suffix = delivered
    ? " Licencia y descarga habilitadas."
    : result.delivery?.status === "failed" || result.delivery?.status === "partial"
      ? " El pago quedó confirmado, pero la entrega quedó pendiente: usá «Reintentar asignación»."
      : " La entrega está en preparación.";
  return { ok: true, message: `${prefix}${suffix}` };
}

export async function rejectPaymentAction(
  orderId: string,
  reason: string,
): Promise<AdminDeliveryActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  if (typeof orderId !== "string" || !allowRequest("admin-reject-payment", orderId, 10, 60_000)) {
    return { ok: false, message: "Esperá un minuto antes de volver a intentar." };
  }
  const order = await findOrder(orderId);
  if (order === null) return { ok: false, message: "No encontramos el pedido." };

  const result = await createManualPaymentService().rejectPayment(
    order.id,
    adminActor(),
    typeof reason === "string" ? reason : null,
  );
  refreshOrderViews(order);
  if (!result.ok) return { ok: false, message: result.message };
  return {
    ok: true,
    message: result.duplicate ? "Este pago ya estaba rechazado." : "Pago rechazado.",
  };
}

/** Reintenta la licencia/descarga sin volver a confirmar el pago. */
export async function retryFulfillmentAction(
  orderId: string,
): Promise<AdminDeliveryActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  if (typeof orderId !== "string" || !allowRequest("admin-fulfillment-retry", orderId, 6, 60_000)) {
    return { ok: false, message: "Esperá un minuto antes de volver a reintentar." };
  }
  const order = await findOrder(orderId);
  if (
    order === null ||
    order.status !== "paid" ||
    order.payment.status !== "approved" ||
    order.fulfillment.status === "fulfilled"
  ) {
    return { ok: false, message: "El pedido no admite un reintento de entrega." };
  }
  const result = await createManualPaymentService().retryDelivery(order.id);
  refreshOrderViews(order);
  if (!result.ok) return { ok: false, message: result.message };
  return {
    ok: result.delivery?.status !== "rejected",
    message: result.delivery?.message ?? "La entrega se volvió a intentar.",
  };
}

export async function revealLicenseAction(
  orderId: string,
  productId: string,
): Promise<AdminDeliveryActionResult & { readonly licenseKey?: string }> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  const order = await findOrder(orderId);
  const item = order?.items.find((candidate) => candidate.productId === productId);
  if (item === undefined || item.licenseStatus !== "issued" || item.licenseKey === null) {
    return { ok: false, message: "La licencia no está disponible." };
  }
  return { ok: true, message: "Licencia visible.", licenseKey: item.licenseKey };
}

/** Consulta al proveedor de licencias si la clave guardada coincide con la suya. */
export async function verifyLicenseAction(
  orderId: string,
  productId: string,
): Promise<AdminDeliveryActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  if (!allowRequest("admin-license-verify", `${orderId}:${productId}`, 6, 60_000)) {
    return { ok: false, message: "Esperá un minuto antes de volver a consultar." };
  }
  const order = await findOrder(orderId);
  if (order === null) return { ok: false, message: "No encontramos el pedido." };
  const result = await createLicenseService().verifyAssignedLicense(order, productId);
  return { ok: result.status === "match", message: result.message };
}

export async function rotatePurchaseAccessAction(
  orderId: string,
): Promise<AdminDeliveryActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  if (!allowRequest("admin-purchase-rotate", orderId, 3, 60_000)) {
    return { ok: false, message: "Esperá un minuto antes de generar otro acceso." };
  }
  const order = await findOrder(orderId);
  if (order === null) return { ok: false, message: "No encontramos el pedido." };
  const rotated = await rotatePurchaseAccess(order.id);
  if (rotated === null) return { ok: false, message: "No encontramos el pedido." };
  refreshOrderViews(order);
  return {
    ok: true,
    message: "Acceso rotado. Los enlaces anteriores (incluidos los enviados por email) dejaron de funcionar.",
    purchasePath: `/compras/${encodeURIComponent(rotated.token)}`,
  };
}

/** Reenvía al comprador el email con la licencia y un enlace privado nuevo. */
export async function resendDeliveryEmailAction(
  orderId: string,
): Promise<AdminDeliveryActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  if (!allowRequest("admin-resend-delivery", orderId, 3, 10 * 60_000)) {
    return { ok: false, message: "Ya reenviaste este email hace poco. Esperá unos minutos." };
  }
  const order = await findOrder(orderId);
  if (order === null) return { ok: false, message: "No encontramos el pedido." };
  if (order.status !== "fulfilled") {
    return { ok: false, message: "El email se puede reenviar cuando la entrega está completa." };
  }
  const outcome = await createNotificationService().resendDelivery(order);
  if (outcome === "sent") return { ok: true, message: `Email reenviado a ${order.customer.email}.` };
  if (outcome === "not_configured") {
    return { ok: false, message: "El envío de emails no está configurado (SMTP)." };
  }
  return { ok: false, message: "No se pudo enviar el email. Revisá la configuración SMTP." };
}
