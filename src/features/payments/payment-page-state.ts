import type { OrderStatus } from "@/types/order";

export type ApprovedPageState = "missing" | "confirming" | "confirmed" | "rejected";

/** La URL nunca decide el resultado: solo el estado persistido del pedido. */
export function resolveApprovedPageState(
  orderStatus: OrderStatus | null,
): ApprovedPageState {
  if (orderStatus === null) return "missing";
  if (orderStatus === "paid" || orderStatus === "fulfilled") return "confirmed";
  if (orderStatus === "failed" || orderStatus === "cancelled") return "rejected";
  return "confirming";
}
