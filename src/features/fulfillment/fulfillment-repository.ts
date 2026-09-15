import "server-only";
import { getKeyValueStore, STORES, type KeyValueStore } from "@/lib/storage/store";
import type { LicenseErrorCode } from "@/types/license";
import type { FulfillmentOperation } from "@/types/fulfillment";

const LEASE_MS = 30_000;

export type ClaimFulfillmentResult =
  | { readonly kind: "acquired"; readonly operation: FulfillmentOperation }
  | { readonly kind: "busy"; readonly operation: FulfillmentOperation }
  | { readonly kind: "issued"; readonly operation: FulfillmentOperation };

export interface FulfillmentRepository {
  find(orderId: string, productId: string): Promise<FulfillmentOperation | null>;
  claim(input: {
    readonly orderId: string;
    readonly productId: string;
    readonly appId: string;
    readonly idempotencyKey: string;
  }): Promise<ClaimFulfillmentResult>;
  complete(
    operation: FulfillmentOperation,
    licenseKey: string,
    issuedAt: string,
  ): Promise<FulfillmentOperation>;
  fail(
    operation: FulfillmentOperation,
    errorCode: LicenseErrorCode,
  ): Promise<FulfillmentOperation>;
}

function operationKey(orderId: string, productId: string): string {
  return `license:${orderId}:${productId}`;
}

export function createFulfillmentRepository(
  store: KeyValueStore = getKeyValueStore(STORES.fulfillment),
  clock: () => Date = () => new Date(),
): FulfillmentRepository {
  async function mutate(
    key: string,
    builder: (current: FulfillmentOperation) => FulfillmentOperation,
  ): Promise<FulfillmentOperation> {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const current = await store.getWithVersion<FulfillmentOperation>(key);
      if (current === null) throw new Error("FULFILLMENT_OPERATION_MISSING");
      const next = builder(current.value);
      if (await store.setIfVersion(key, next, current.version)) return next;
    }
    throw new Error("FULFILLMENT_CONCURRENT_UPDATE_RETRY_EXHAUSTED");
  }

  return {
    find(orderId, productId) {
      return store.get<FulfillmentOperation>(operationKey(orderId, productId));
    },

    async claim(input) {
      const key = operationKey(input.orderId, input.productId);

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const now = clock();
        const current = await store.getWithVersion<FulfillmentOperation>(key);

        if (current === null) {
          const operation: FulfillmentOperation = {
            ...input,
            status: "pending",
            attemptId: crypto.randomUUID(),
            attemptCount: 1,
            leaseUntil: new Date(now.getTime() + LEASE_MS).toISOString(),
            licenseKey: null,
            issuedAt: null,
            errorCode: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
          };
          if (await store.setIfAbsent(key, operation)) {
            return { kind: "acquired", operation };
          }
          continue;
        }

        const operation = current.value;
        if (
          operation.appId !== input.appId ||
          operation.idempotencyKey !== input.idempotencyKey
        ) {
          throw new Error("FULFILLMENT_IDEMPOTENCY_CONFLICT");
        }
        if (operation.status === "issued") return { kind: "issued", operation };
        if (
          operation.status === "pending" &&
          operation.leaseUntil !== null &&
          operation.leaseUntil > now.toISOString()
        ) {
          return { kind: "busy", operation };
        }

        const retried: FulfillmentOperation = {
          ...operation,
          status: "pending",
          attemptId: crypto.randomUUID(),
          attemptCount: operation.attemptCount + 1,
          leaseUntil: new Date(now.getTime() + LEASE_MS).toISOString(),
          errorCode: null,
          updatedAt: now.toISOString(),
        };
        if (await store.setIfVersion(key, retried, current.version)) {
          return { kind: "acquired", operation: retried };
        }
      }

      throw new Error("FULFILLMENT_CLAIM_RETRY_EXHAUSTED");
    },

    async complete(operation, licenseKey, issuedAt) {
      return mutate(operationKey(operation.orderId, operation.productId), (current) => {
        if (current.status === "issued") {
          if (current.licenseKey !== licenseKey) {
            throw new Error("FULFILLMENT_LICENSE_CONFLICT");
          }
          return current;
        }
        return {
          ...current,
          status: "issued",
          leaseUntil: null,
          licenseKey,
          issuedAt,
          errorCode: null,
          updatedAt: clock().toISOString(),
        };
      });
    },

    async fail(operation, errorCode) {
      return mutate(operationKey(operation.orderId, operation.productId), (current) => {
        if (current.status === "issued") return current;
        if (current.attemptId !== operation.attemptId) return current;
        return {
          ...current,
          status: "failed",
          leaseUntil: null,
          errorCode,
          updatedAt: clock().toISOString(),
        };
      });
    },
  };
}

let repository: FulfillmentRepository | null = null;

export function getFulfillmentRepository(): FulfillmentRepository {
  if (repository === null) repository = createFulfillmentRepository();
  return repository;
}
