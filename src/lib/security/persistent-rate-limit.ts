import "server-only";

import { createHash } from "node:crypto";
import { getKeyValueStore, STORES } from "@/lib/storage/store";

interface RateLimitRecord {
  readonly count: number;
  readonly resetAt: number;
}

function key(scope: string, identifier: string): string {
  const digest = createHash("sha256").update(identifier).digest("hex");
  return `${scope}:${digest}`;
}

/** Límite compartido por todas las instancias serverless mediante Netlify Blobs. */
export async function allowPersistentRequest(
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  const store = getKeyValueStore(STORES.rateLimits);
  const recordKey = key(scope, identifier);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const now = Date.now();
    const current = await store.getWithVersion<RateLimitRecord>(recordKey);
    if (current === null) {
      if (await store.setIfAbsent(recordKey, { count: 1, resetAt: now + windowMs })) return true;
      continue;
    }

    if (current.value.resetAt <= now) {
      if (
        await store.setIfVersion(
          recordKey,
          { count: 1, resetAt: now + windowMs },
          current.version,
        )
      ) return true;
      continue;
    }

    if (current.value.count >= limit) return false;
    if (
      await store.setIfVersion(
        recordKey,
        { ...current.value, count: current.value.count + 1 },
        current.version,
      )
    ) return true;
  }

  return false;
}
