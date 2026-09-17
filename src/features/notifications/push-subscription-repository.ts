import "server-only";

import { createHash } from "node:crypto";
import type { PushSubscriptionKeys } from "@/lib/push/web-push-sender";
import { getKeyValueStore, STORES, type KeyValueStore } from "@/lib/storage/store";

/**
 * Dispositivos del Admin que reciben avisos.
 *
 * Solo se aceptan servicios push reales de los navegadores: el servidor le hace un
 * POST a la dirección de cada suscripción, así que una dirección arbitraria podría
 * usarse para pegarle a servicios internos.
 */

const PUSH_HOST_SUFFIXES = [
  "fcm.googleapis.com",
  "android.googleapis.com",
  "push.services.mozilla.com",
  "push.apple.com",
  "notify.windows.com",
] as const;

const MAX_SUBSCRIPTIONS = 20;

export interface PushSubscriptionRecord extends PushSubscriptionKeys {
  readonly id: string;
  /** Descripción corta del dispositivo, elegida por el panel. */
  readonly label: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly failureCount: number;
}

export function subscriptionId(endpoint: string): string {
  return createHash("sha256").update(endpoint).digest("hex");
}

function base64UrlBytes(value: unknown): number {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]+={0,2}$/.test(value)) return -1;
  return Buffer.from(value.replace(/=+$/, ""), "base64url").length;
}

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.port !== "") {
      return false;
    }
    const host = url.hostname.toLowerCase();
    return PUSH_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

/** Valida el objeto que manda `PushSubscription.toJSON()`. Todo lo demás se descarta. */
export function parsePushSubscription(value: unknown): PushSubscriptionKeys | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  if (typeof candidate.endpoint !== "string" || candidate.endpoint.length > 1024) return null;
  if (!isAllowedPushEndpoint(candidate.endpoint)) return null;
  const p256dh = candidate.keys?.p256dh;
  const auth = candidate.keys?.auth;
  // p256dh: punto P-256 sin comprimir (65 bytes). auth: 16 bytes.
  if (base64UrlBytes(p256dh) !== 65 || base64UrlBytes(auth) !== 16) return null;
  return {
    endpoint: candidate.endpoint,
    keys: { p256dh: p256dh as string, auth: auth as string },
  };
}

export interface PushSubscriptionRepository {
  list(): Promise<readonly PushSubscriptionRecord[]>;
  save(subscription: PushSubscriptionKeys, label: string): Promise<PushSubscriptionRecord>;
  remove(endpoint: string): Promise<void>;
  recordResult(id: string, ok: boolean): Promise<void>;
}

const recordKey = (id: string) => `sub:${id}`;

export function createPushSubscriptionRepository(
  store: KeyValueStore = getKeyValueStore(STORES.pushSubscriptions),
  clock: () => Date = () => new Date(),
): PushSubscriptionRepository {
  async function list(): Promise<readonly PushSubscriptionRecord[]> {
    const keys = (await store.keys()).filter((key) => key.startsWith("sub:"));
    const values = await Promise.all(keys.map((key) => store.get<PushSubscriptionRecord>(key)));
    return values
      .filter((value): value is PushSubscriptionRecord => value !== null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  return {
    list,

    async save(subscription, label) {
      const id = subscriptionId(subscription.endpoint);
      const existing = await store.get<PushSubscriptionRecord>(recordKey(id));
      if (existing === null && (await list()).length >= MAX_SUBSCRIPTIONS) {
        throw new Error("PUSH_SUBSCRIPTION_LIMIT");
      }
      const now = clock().toISOString();
      const record: PushSubscriptionRecord = {
        id,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        label: label.slice(0, 60),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lastSuccessAt: existing?.lastSuccessAt ?? null,
        lastFailureAt: existing?.lastFailureAt ?? null,
        failureCount: 0,
      };
      await store.set(recordKey(id), record);
      return record;
    },

    async remove(endpoint) {
      await store.remove(recordKey(subscriptionId(endpoint)));
    },

    async recordResult(id, ok) {
      const key = recordKey(id);
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const current = await store.getWithVersion<PushSubscriptionRecord>(key);
        if (current === null) return;
        const now = clock().toISOString();
        const next: PushSubscriptionRecord = ok
          ? { ...current.value, lastSuccessAt: now, failureCount: 0 }
          : { ...current.value, lastFailureAt: now, failureCount: current.value.failureCount + 1 };
        if (await store.setIfVersion(key, next, current.version)) return;
      }
    },
  };
}

let repository: PushSubscriptionRepository | null = null;

export function getPushSubscriptionRepository(): PushSubscriptionRepository {
  if (repository === null) repository = createPushSubscriptionRepository();
  return repository;
}
