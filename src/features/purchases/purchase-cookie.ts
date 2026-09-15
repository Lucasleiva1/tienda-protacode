import "server-only";
import { cookies } from "next/headers";
import { isPurchaseAccessToken, tokenMatchesOrder } from "@/features/purchases/purchase-access";
import type { Order } from "@/types/order";

const COOKIE_NAME = "pc_purchase_access";

export async function setPurchaseAccessCookie(token: string): Promise<void> {
  if (!isPurchaseAccessToken(token)) throw new Error("PURCHASE_ACCESS_TOKEN_INVALID");
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}

export async function purchaseHrefFromCookie(order: Order): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (token === undefined || !(await tokenMatchesOrder(token, order))) return null;
  return `/compras/${encodeURIComponent(token)}`;
}
