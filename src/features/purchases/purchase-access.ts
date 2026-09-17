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
/** Enlaces por email que se conservan a la vez. El más viejo se revoca primero. */
const MAX_EXTRA_TOKENS = 5;

interface AccessDependencies {
  readonly orders?: OrderRepository;
  readonly access?: PurchaseAccessRepository;
}

export function hashPurchaseAccessToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function newToken(): { readonly token: string; readonly tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return { token, tokenHash: hashPurchaseAccessToken(token) };
}

export function createPurchaseAccess(): {
  readonly token: string;
  readonly record: PurchaseAccess;
} {
  const { token, tokenHash } = newToken();
  return {
    token,
    record: {
      tokenHash,
      createdAt: new Date().toISOString(),
      rotatedAt: null,
      extraTokenHashes: [],
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

function accessMatches(access: PurchaseAccess, tokenHash: string): boolean {
  // Se comparan todos, sin cortar en el primero, para no filtrar cuál coincidió.
  let match = false;
  for (const candidate of [access.tokenHash, ...access.extraTokenHashes]) {
    if (sameHash(candidate, tokenHash)) match = true;
  }
  return match;
}

export async function findOrderByPurchaseToken(
  token: string,
  dependencies: AccessDependencies = {},
): Promise<Order | null> {
  if (!isPurchaseAccessToken(token)) return null;
  const tokenHash = hashPurchaseAccessToken(token);
  const access = dependencies.access ?? getPurchaseAccessRepository();
  const orders = dependencies.orders ?? getOrderRepository();
  const orderId = await access.findOrderId(tokenHash);
  if (orderId === null) return null;
  const order = await orders.findById(orderId);
  if (order === null || order.purchaseAccess === null) return null;
  return accessMatches(order.purchaseAccess, tokenHash) ? order : null;
}

export async function tokenMatchesOrder(token: string, order: Order): Promise<boolean> {
  if (!isPurchaseAccessToken(token) || order.purchaseAccess === null) return false;
  return accessMatches(order.purchaseAccess, hashPurchaseAccessToken(token));
}

/**
 * Nuevo enlace privado para enviar por email.
 *
 * No reemplaza el principal: el comprador puede tener la página abierta mientras el
 * Admin confirma el pago, y esa página tiene que seguir funcionando.
 */
export async function issueAdditionalPurchaseAccess(
  orderId: string,
  dependencies: AccessDependencies = {},
): Promise<string | null> {
  const orders = dependencies.orders ?? getOrderRepository();
  const access = dependencies.access ?? getPurchaseAccessRepository();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = newToken();
    if (!(await access.reserve(next.tokenHash, orderId))) continue;

    let dropped: readonly string[] = [];
    try {
      const updated = await orders.updateAtomically(orderId, (order) => {
        if (order.purchaseAccess === null) {
          dropped = [];
          return order;
        }
        const all = [...order.purchaseAccess.extraTokenHashes, next.tokenHash];
        dropped = all.slice(0, Math.max(0, all.length - MAX_EXTRA_TOKENS));
        return {
          ...order,
          purchaseAccess: {
            ...order.purchaseAccess,
            extraTokenHashes: all.slice(-MAX_EXTRA_TOKENS),
          },
        };
      });
      if (updated === null || updated.purchaseAccess === null) {
        await access.remove(next.tokenHash);
        return null;
      }
      for (const hash of dropped) await access.remove(hash);
      return next.token;
    } catch (error) {
      await access.remove(next.tokenHash);
      throw error;
    }
  }
  throw new Error("PURCHASE_ACCESS_TOKEN_COLLISION");
}

export async function rotatePurchaseAccess(
  orderId: string,
  dependencies: AccessDependencies = {},
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
    let previous: PurchaseAccess | null = null;
    const updated = await orders.updateAtomically(orderId, (order) => {
      previous = order.purchaseAccess;
      return {
        ...order,
        purchaseAccess: {
          ...next.record,
          createdAt: order.purchaseAccess?.createdAt ?? next.record.createdAt,
          rotatedAt: new Date().toISOString(),
        },
      };
    });
    if (updated === null) {
      await access.remove(next.record.tokenHash);
      return null;
    }
    const revoked = previous as PurchaseAccess | null;
    if (revoked !== null) {
      for (const hash of [revoked.tokenHash, ...revoked.extraTokenHashes]) {
        await access.remove(hash);
      }
    }
    return { token: next.token, order: updated };
  } catch (error) {
    await access.remove(next.record.tokenHash);
    throw error;
  }
}
