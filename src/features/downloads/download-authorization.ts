import "server-only";
import { findOrderByPurchaseToken } from "@/features/purchases/purchase-access";
import { isOrderId } from "@/features/orders/order-id";
import type { OrderRepository } from "@/features/orders/order-repository";
import { isItemDownloadEnabled } from "@/features/payments/manual-payment-state";
import type { PurchaseAccessRepository } from "@/features/purchases/purchase-access-repository";
import type { DownloadFileReference } from "@/types/download";
import type { Order } from "@/types/order";

export type DownloadAuthorizationResult =
  | { readonly ok: true; readonly file: DownloadFileReference }
  | {
      readonly ok: false;
      readonly code: "NOT_FOUND" | "NOT_READY";
      readonly message: string;
    };

export async function authorizeDownload(input: {
  readonly orderId: string;
  readonly productId: string;
  readonly purchaseToken: string;
}, dependencies: {
  readonly orders?: OrderRepository;
  readonly access?: PurchaseAccessRepository;
} = {}): Promise<DownloadAuthorizationResult> {
  if (!isOrderId(input.orderId) || !/^[a-zA-Z0-9-]{8,}$/.test(input.productId)) {
    return { ok: false, code: "NOT_FOUND", message: "Descarga no encontrada." };
  }

  const order = await findOrderByPurchaseToken(input.purchaseToken, dependencies);
  if (order === null || order.id !== input.orderId) {
    return { ok: false, code: "NOT_FOUND", message: "Descarga no encontrada." };
  }
  return authorizeOrderItemDownload(order, input.productId);
}

/**
 * Autorización para un pedido ya resuelto por un acceso válido (token o sesión del
 * dueño). Exige pago confirmado, licencia resuelta y archivo asociado.
 */
export function authorizeOrderItemDownload(
  order: Order,
  productId: string,
): DownloadAuthorizationResult {
  const item = order.items.find((candidate) => candidate.productId === productId);
  if (item === undefined) {
    return { ok: false, code: "NOT_FOUND", message: "Descarga no encontrada." };
  }
  if (!isItemDownloadEnabled(order, item) || item.downloadFile === null) {
    return {
      ok: false,
      code: "NOT_READY",
      message: "La descarga todavía no está preparada.",
    };
  }
  return { ok: true, file: item.downloadFile };
}
