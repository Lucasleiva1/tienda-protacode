import "server-only";
import { getKeyValueStore, STORES, type KeyValueStore } from "@/lib/storage/store";

/**
 * Referencias legibles de pedido: PC-1001, PC-1002…
 *
 * El número sale de un contador guardado con escritura condicional: dos compras
 * simultáneas, aunque caigan en instancias distintas de Netlify, nunca reciben el
 * mismo número. Además cada referencia se reserva con creación atómica, así un
 * contador restaurado desde un respaldo tampoco puede reutilizar un número vendido.
 *
 * Que el número sea correlativo no expone pedidos: para ver uno hace falta su token
 * privado o la sesión de su dueño.
 */

export const ORDER_REFERENCE_PREFIX = "PC-";
const FIRST_NUMBER = 1001;
const SEQUENCE_KEY = "sequence";
const REFERENCE_PATTERN = /^PC-(\d{4,9})$/;

interface SequenceRecord {
  readonly last: number;
  readonly updatedAt: string;
}

interface IndexRecord {
  readonly orderId: string;
  readonly createdAt: string;
}

export function formatOrderReference(value: number): string {
  return `${ORDER_REFERENCE_PREFIX}${value}`;
}

/** Acepta mayúsculas o minúsculas y espacios alrededor. Devuelve `null` si no es válida. */
export function normalizeOrderReference(value: string): string | null {
  const candidate = value.trim().toUpperCase();
  return REFERENCE_PATTERN.test(candidate) ? candidate : null;
}

export interface OrderReferenceRepository {
  /** Reserva la próxima referencia libre para el pedido. */
  allocate(orderId: string): Promise<string>;
  findOrderId(reference: string): Promise<string | null>;
  release(reference: string, orderId: string): Promise<void>;
  /**
   * Índice idempotente: la primera llamada gana y las siguientes devuelven el
   * pedido ya registrado. `isStale` permite reemplazar una entrada que apunta a un
   * pedido que nunca llegó a guardarse.
   */
  claimIndex(
    key: string,
    orderId: string,
    isStale: (existing: { readonly orderId: string; readonly createdAt: string }) => Promise<boolean>,
  ): Promise<{ readonly created: boolean; readonly orderId: string }>;
  releaseIndex(key: string, orderId: string): Promise<void>;
}

const referenceKey = (reference: string) => `ref:${reference}`;
const indexKey = (key: string) => `index:${key}`;

export function createOrderReferenceRepository(
  store: KeyValueStore = getKeyValueStore(STORES.orderReferences),
  clock: () => Date = () => new Date(),
): OrderReferenceRepository {
  async function releaseIfOwned(key: string, orderId: string): Promise<void> {
    const current = await store.get<IndexRecord>(key);
    if (current?.orderId === orderId) await store.remove(key);
  }

  return {
    async allocate(orderId) {
      for (let attempt = 0; attempt < 16; attempt += 1) {
        const now = clock().toISOString();
        const current = await store.getWithVersion<SequenceRecord>(SEQUENCE_KEY);
        let next: number;

        if (current === null) {
          next = FIRST_NUMBER;
          if (!(await store.setIfAbsent<SequenceRecord>(SEQUENCE_KEY, { last: next, updatedAt: now }))) {
            continue;
          }
        } else {
          const last = current.value.last;
          if (!Number.isSafeInteger(last) || last < FIRST_NUMBER - 1) {
            throw new Error("ORDER_REFERENCE_SEQUENCE_CORRUPTED");
          }
          next = last + 1;
          if (
            !(await store.setIfVersion<SequenceRecord>(
              SEQUENCE_KEY,
              { last: next, updatedAt: now },
              current.version,
            ))
          ) {
            continue;
          }
        }

        const reference = formatOrderReference(next);
        if (await store.setIfAbsent<IndexRecord>(referenceKey(reference), { orderId, createdAt: now })) {
          return reference;
        }
        // Número ya usado (contador restaurado): se avanza al siguiente.
      }
      throw new Error("ORDER_REFERENCE_ALLOCATION_EXHAUSTED");
    },

    async findOrderId(reference) {
      const normalized = normalizeOrderReference(reference);
      if (normalized === null) return null;
      return (await store.get<IndexRecord>(referenceKey(normalized)))?.orderId ?? null;
    },

    async release(reference, orderId) {
      await releaseIfOwned(referenceKey(reference), orderId);
    },

    async claimIndex(key, orderId, isStale) {
      const recordKey = indexKey(key);
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const now = clock().toISOString();
        if (await store.setIfAbsent<IndexRecord>(recordKey, { orderId, createdAt: now })) {
          return { created: true, orderId };
        }
        const current = await store.getWithVersion<IndexRecord>(recordKey);
        if (current === null) continue;
        if (current.value.orderId === orderId) return { created: true, orderId };
        if (!(await isStale(current.value))) {
          return { created: false, orderId: current.value.orderId };
        }
        if (await store.setIfVersion<IndexRecord>(recordKey, { orderId, createdAt: now }, current.version)) {
          return { created: true, orderId };
        }
      }
      throw new Error("ORDER_INDEX_CLAIM_EXHAUSTED");
    },

    async releaseIndex(key, orderId) {
      await releaseIfOwned(indexKey(key), orderId);
    },
  };
}

let repository: OrderReferenceRepository | null = null;

export function getOrderReferenceRepository(): OrderReferenceRepository {
  if (repository === null) repository = createOrderReferenceRepository();
  return repository;
}
