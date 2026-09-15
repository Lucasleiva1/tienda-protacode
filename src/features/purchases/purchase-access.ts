import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getOrderRepository } from "@/features/orders/persistent-order-repository";
import type { OrderRepository } from "@/features/orders/order-repository";
import {
  getPurchaseAccessRepository,
  type PurchaseAccessRepository,
} from "@/features/purchases/purchase-access-repository";
import type { Order, PurchaseAccess } from "@/types/order";

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function hashPurchaseAccessToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createPurchaseAccess(): {
  readonly token: string;
  readonly record: PurchaseAccess;
} {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return {
    token,
    record: {
      tokenHash: hashPurchaseAccessToken(token),
      createdAt: new Date().toISOString(),
      rotatedAt: null,
    },
  };
}

export function isPurchaseAccessToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

function sameHash(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}

export async function findOrderByPurchaseToken(
  token: string,
  dependencies: {
    readonly orders?: OrderRepository;
    readonly access?: PurchaseAccessRepository;
  } = {},
): Promise<Order | null> {
  if (!isPurchaseAccessToken(token)) return null;
  const tokenHash = hashPurchaseAccessToken(token);
  const access = dependencies.access ?? getPurchaseAccessRepository();
  const orders = dependencies.orders ?? getOrderRepository();
  const orderId = await access.findOrderId(tokenHash);
  if (orderId === null) return null;
  const order = await orders.findById(orderId);
  if (order === null || order.purchaseAccess === null) return null;
  return sameHash(order.purchaseAccess.tokenHash, tokenHash) ? order : null;
}

export async function tokenMatchesOrder(token: string, order: Order): Promise<boolean> {
  if (!isPurchaseAccessToken(token) || order.purchaseAccess === null) return false;
  return sameHash(order.purchaseAccess.tokenHash, hashPurchaseAccessToken(token));
}

export async function rotatePurchaseAccess(
  orderId: string,
  dependencies: {
    readonly orders?: OrderRepository;
    readonly access?: PurchaseAccessRepository;
  } = {},
): Promise<{ readonly token: string; readonly order: Order } | null> {
  const orders = dependencies.orders ?? getOrderRepository();
  const access = dependencies.access ?? getPurchaseAccessRepository();
  const current = await orders.findById(orderId);
  if (current === null) return null;

  const next = createPurchaseAccess();
  if (!(await access.reserve(next.record.tokenHash, orderId))) {
    return rotatePurchaseAccess(orderId, dependencies);
  }

  try {
    const updated = await orders.updateAtomically(orderId, (order) => ({
      ...order,
      purchaseAccess: {
        ...next.record,
        createdAt: order.purchaseAccess?.createdAt ?? next.record.createdAt,
        rotatedAt: new Date().toISOString(),
      },
    }));
    if (updated === null) {
      await access.remove(next.record.tokenHash);
      return null;
    }
    if (current.purchaseAccess !== null) {
      await access.remove(current.purchaseAccess.tokenHash);
    }
    return { token: next.token, order: updated };
  } catch (error) {
    await access.remove(next.record.tokenHash);
    throw error;
  }
}
