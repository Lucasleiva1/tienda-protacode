import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { getKeyValueStore, STORES } from "@/lib/storage/store";
import { markCustomerEmailVerified } from "@/features/accounts/customer-repository";

const TOKEN_BYTES = 32;
const DURATION_MS = 24 * 60 * 60 * 1000;

interface VerificationRecord {
  readonly accountId: string;
  readonly email: string;
  readonly expiresAt: number;
  readonly usedAt: string | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function key(token: string): string {
  return `verify:${hashToken(token)}`;
}

function latestKey(accountId: string): string {
  return `latest:${accountId}`;
}

export function isVerificationToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export async function issueEmailVerification(
  accountId: string,
  email: string,
): Promise<string> {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const store = getKeyValueStore(STORES.customerVerifications);
  const tokenHash = hashToken(token);
  await store.set<VerificationRecord>(key(token), {
    accountId,
    email,
    expiresAt: Date.now() + DURATION_MS,
    usedAt: null,
  });
  // Un reenvío invalida los enlaces anteriores de la misma cuenta.
  await store.set(latestKey(accountId), tokenHash);
  return token;
}

export async function consumeEmailVerification(token: string): Promise<string | null> {
  if (!isVerificationToken(token)) return null;
  const store = getKeyValueStore(STORES.customerVerifications);
  const recordKey = key(token);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await store.getWithVersion<VerificationRecord>(recordKey);
    if (
      current === null ||
      current.value.usedAt !== null ||
      current.value.expiresAt <= Date.now()
    ) return null;
    const latest = await store.get<string>(latestKey(current.value.accountId));
    if (latest !== hashToken(token)) return null;

    const used = { ...current.value, usedAt: new Date().toISOString() };
    if (!(await store.setIfVersion(recordKey, used, current.version))) continue;
    const account = await markCustomerEmailVerified(current.value.accountId, current.value.email);
    await store.remove(latestKey(current.value.accountId));
    return account?.id ?? null;
  }

  return null;
}
