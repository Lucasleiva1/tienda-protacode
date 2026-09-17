import "server-only";

import type { OrderRepository } from "@/features/orders/order-repository";
import {
  findAllOrders,
  getOrderRepository,
} from "@/features/orders/persistent-order-repository";
import type { CustomerAccount } from "@/types/customer-account";
import type { Order } from "@/types/order";

/**
 * Asocia a la cuenta las compras hechas como invitado con el mismo email.
 *
 * Solo con email verificado (por Google o por el enlace de confirmación): quien
 * demuestra ser dueño del correo es quien recibió los enlaces privados de esas
 * compras. Después de esto, "Mis compras" filtra estrictamente por `accountId`.
 */
export async function linkGuestOrdersToAccount(
  account: CustomerAccount,
  dependencies: {
    readonly listOrders?: () => Promise<readonly Order[]>;
    readonly orders?: OrderRepository;
  } = {},
): Promise<number> {
  if (!account.emailVerified) return 0;
  const email = account.email.trim().toLowerCase();
  const listOrders = dependencies.listOrders ?? findAllOrders;
  const orders = dependencies.orders ?? getOrderRepository();

  const candidates = (await listOrders()).filter(
    (order) => !order.customer.accountId && order.customer.email.trim().toLowerCase() === email,
  );

  let linked = 0;
  for (const candidate of candidates) {
    let changed = false;
    await orders.updateAtomically(candidate.id, (current) => {
      changed = false;
      if (current.customer.accountId || current.customer.email.trim().toLowerCase() !== email) {
        return current;
      }
      changed = true;
      return { ...current, customer: { ...current.customer, accountId: account.id } };
    });
    if (changed) linked += 1;
  }
  return linked;
}
