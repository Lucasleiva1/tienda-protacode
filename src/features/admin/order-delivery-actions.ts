"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, NO_AUTORIZADO } from "@/features/admin/guard";
import { createFulfillmentService } from "@/features/fulfillment/fulfillment-service";
import { findOrder } from "@/features/orders/order-service";
import { rotatePurchaseAccess } from "@/features/purchases/purchase-access";
import { allowRequest } from "@/lib/security/rate-limit";

export type AdminDeliveryActionResult =
  | { readonly ok: true; readonly message: string; readonly purchasePath?: string }
  | { readonly ok: false; readonly message: string };

export async function retryFulfillmentAction(
  orderId: string,
): Promise<AdminDeliveryActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  if (!allowRequest("admin-fulfillment-retry", orderId, 6, 60_000)) {
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
  const result = await createFulfillmentService().fulfill(orderId);
  revalidatePath(`/admin/pedidos/${orderId}`);
  return { ok: result.status !== "rejected", message: result.message };
}

export async function revealLicenseAction(
  orderId: string,
  productId: string,
): Promise<AdminDeliveryActionResult & { readonly licenseKey?: string }> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  const order = await findOrder(orderId);
  const item = order?.items.find((candidate) => candidate.productId === productId);
  if (item?.licenseStatus !== "issued" || item.licenseKey === null || item === undefined) {
    return { ok: false, message: "La licencia no está disponible." };
  }
  return { ok: true, message: "Licencia visible.", licenseKey: item.licenseKey };
}

export async function rotatePurchaseAccessAction(
  orderId: string,
): Promise<AdminDeliveryActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  if (!allowRequest("admin-purchase-rotate", orderId, 3, 60_000)) {
    return { ok: false, message: "Esperá un minuto antes de generar otro acceso." };
  }
  const rotated = await rotatePurchaseAccess(orderId);
  if (rotated === null) return { ok: false, message: "No encontramos el pedido." };
  revalidatePath(`/admin/pedidos/${orderId}`);
  return {
    ok: true,
    message: "Acceso rotado. El enlace anterior dejó de funcionar.",
    purchasePath: `/compras/${encodeURIComponent(rotated.token)}`,
  };
}
