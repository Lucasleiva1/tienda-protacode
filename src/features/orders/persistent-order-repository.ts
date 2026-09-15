import "server-only";
import { normalizeOrder } from "@/features/orders/order-normalization";
import type { OrderRepository } from "@/features/orders/order-repository";
import { getKeyValueStore, STORES } from "@/lib/storage/store";
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
function createPersistentOrderRepository(): OrderRepository {
  const store = getKeyValueStore(STORES.orders);

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
        const next = {
          ...updater(normalizeOrder(current.value)),
          updatedAt: new Date().toISOString(),
        };
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

let repositorio: OrderRepository | null = null;

export function getOrderRepository(): OrderRepository {
  if (repositorio === null) {
    repositorio = createPersistentOrderRepository();
  }
  return repositorio;
}
