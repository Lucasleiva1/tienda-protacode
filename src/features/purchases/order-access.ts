import "server-only";

import { getCurrentCustomerAccount } from "@/features/accounts/customer-session";
import { findOrder } from "@/features/orders/order-service";
import { findOrderByPurchaseToken } from "@/features/purchases/purchase-access";
import type { Order } from "@/types/order";

/**
 * Acceso a un pedido desde el navegador.
 *
 * Hay exactamente dos llaves:
 *   - `token`: el enlace privado (compras como invitado o enviado por email);
 *   - `account`: la sesión de la tienda, y solo si el pedido pertenece a esa cuenta.
 *
 * Un número de pedido por sí solo nunca da acceso: sin token válido o sin ser el
 * dueño, la respuesta es la misma que si el pedido no existiera (evita IDOR).
 */

export type OrderAccessInput =
  | { readonly kind: "token"; readonly token: string }
  | { readonly kind: "account"; readonly orderId: string };

export function parseOrderAccessInput(value: unknown): OrderAccessInput | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { kind?: unknown; token?: unknown; orderId?: unknown };
  if (candidate.kind === "token" && typeof candidate.token === "string" && candidate.token.length <= 64) {
    return { kind: "token", token: candidate.token };
  }
  if (candidate.kind === "account" && typeof candidate.orderId === "string" && candidate.orderId.length <= 64) {
    return { kind: "account", orderId: candidate.orderId };
  }
  return null;
}

/** Regla de propiedad: el pedido es de la cuenta autenticada, comparado en el servidor. */
export function isOrderOwnedBy(order: Pick<Order, "customer">, accountId: string): boolean {
  return (
    typeof order.customer.accountId === "string" &&
    order.customer.accountId !== "" &&
    order.customer.accountId === accountId
  );
}

export interface OrderAccessDependencies {
  readonly findByToken: (token: string) => Promise<Order | null>;
  readonly findById: (idOrReference: string) => Promise<Order | null>;
  readonly currentAccountId: () => Promise<string | null>;
}

const defaultDependencies: OrderAccessDependencies = {
  findByToken: (token) => findOrderByPurchaseToken(token),
  findById: (value) => findOrder(value),
  currentAccountId: async () => (await getCurrentCustomerAccount())?.id ?? null,
};

export async function resolveOrderAccess(
  input: OrderAccessInput,
  dependencies: OrderAccessDependencies = defaultDependencies,
): Promise<Order | null> {
  if (input.kind === "token") return dependencies.findByToken(input.token);

  const accountId = await dependencies.currentAccountId();
  if (accountId === null) return null;
  const order = await dependencies.findById(input.orderId);
  return order !== null && isOrderOwnedBy(order, accountId) ? order : null;
}
