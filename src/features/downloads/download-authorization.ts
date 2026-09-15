import "server-only";
import { findOrderByPurchaseToken } from "@/features/purchases/purchase-access";
import { isOrderId } from "@/features/orders/order-service";
import type { OrderRepository } from "@/features/orders/order-repository";
import type { PurchaseAccessRepository } from "@/features/purchases/purchase-access-repository";
import type { DownloadFileReference } from "@/types/download";

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
  const item = order.items.find((candidate) => candidate.productId === input.productId);
  if (item === undefined) {
    return { ok: false, code: "NOT_FOUND", message: "Descarga no encontrada." };
  }
  if (
    (order.status !== "paid" && order.status !== "fulfilled") ||
    order.payment.status !== "approved" ||
    item.licenseStatus !== "issued" ||
    item.licenseKey === null ||
    item.downloadFile === null ||
    item.downloadEnabledAt === null
  ) {
    return {
      ok: false,
      code: "NOT_READY",
      message: "La descarga todavía no está preparada.",
    };
  }
  return { ok: true, file: item.downloadFile };
}
