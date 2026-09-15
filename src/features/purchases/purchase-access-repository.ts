import "server-only";
import { getKeyValueStore, STORES } from "@/lib/storage/store";

interface PurchaseAccessIndex {
  readonly orderId: string;
  readonly createdAt: string;
}

export interface PurchaseAccessRepository {
  reserve(tokenHash: string, orderId: string): Promise<boolean>;
  findOrderId(tokenHash: string): Promise<string | null>;
  remove(tokenHash: string): Promise<void>;
}

export function createPurchaseAccessRepository(
  store = getKeyValueStore(STORES.purchaseAccess),
): PurchaseAccessRepository {
  const key = (hash: string) => `token:${hash}`;

  return {
    async reserve(tokenHash, orderId) {
      return store.setIfAbsent<PurchaseAccessIndex>(key(tokenHash), {
        orderId,
        createdAt: new Date().toISOString(),
      });
    },

    async findOrderId(tokenHash) {
      return (await store.get<PurchaseAccessIndex>(key(tokenHash)))?.orderId ?? null;
    },

    async remove(tokenHash) {
      await store.remove(key(tokenHash));
    },
  };
}

let repository: PurchaseAccessRepository | null = null;

export function getPurchaseAccessRepository(): PurchaseAccessRepository {
  if (repository === null) repository = createPurchaseAccessRepository();
  return repository;
}
