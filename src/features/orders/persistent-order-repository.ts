import "server-only";
import { normalizeOrder } from "@/features/orders/order-normalization";
import type { OrderRepository } from "@/features/orders/order-repository";
import { getKeyValueStore, STORES, type KeyValueStore } from "@/lib/storage/store";
import type { Order } from "@/types/order";

/**
 * Almacén de pedidos.
 *
 * Reemplaza al de memoria que se usaba en la Parte 5. Ahora los pedidos sobreviven
 * al reinicio del servidor y, en Netlify, a que cada visita caiga en una instancia
 * distinta. Un pedido que se pierde es una venta que se pierde.
 *
 * Un pedido por clave, igual que los productos.
 */
export function createPersistentOrderRepository(
  store: KeyValueStore = getKeyValueStore(STORES.orders),
): OrderRepository {
  return {
    name: `OrderRepository (${store.engine})`,

    async save(order) {
      await store.set(order.id, order);
    },

    async findById(id) {
      const order = await store.get<Order>(id);
      return order === null ? null : normalizeOrder(order);
    },

    async update(order) {
      await store.set(order.id, {
        ...order,
        updatedAt: new Date().toISOString(),
      });
    },

    async updateAtomically(id, updater) {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const current = await store.getWithVersion<Order>(id);
        if (current === null) return null;
        const normalized = normalizeOrder(current.value);
        const updated = updater(normalized);
        // El actualizador devolvió el mismo objeto: no hay nada que escribir.
        if (updated === normalized) return normalized;
        const next = { ...updated, updatedAt: new Date().toISOString() };
        if (await store.setIfVersion(id, next, current.version)) return next;
      }
      throw new Error("ORDER_CONCURRENT_UPDATE_RETRY_EXHAUSTED");
    },
  };
}

/** Todos los pedidos, del más nuevo al más viejo. Para el Admin. */
export async function findAllOrders(): Promise<readonly Order[]> {
  const store = getKeyValueStore(STORES.orders);
  const claves = await store.keys();
  const leidos = await Promise.all(claves.map((c) => store.get<Order>(c)));

  return leidos
    .filter((o): o is Order => o !== null)
    .map(normalizeOrder)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Pedidos de una cuenta. El filtro es server-side y exacto por `accountId`: nunca
 * por datos que mande el navegador.
 */
export async function findOrdersByAccount(accountId: string): Promise<readonly Order[]> {
  if (accountId.trim() === "") return [];
  const todos = await findAllOrders();
  return todos.filter((order) => order.customer.accountId === accountId);
}

let repositorio: OrderRepository | null = null;

export function getOrderRepository(): OrderRepository {
  if (repositorio === null) {
    repositorio = createPersistentOrderRepository();
  }
  return repositorio;
}
