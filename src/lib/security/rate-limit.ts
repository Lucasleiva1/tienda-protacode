import "server-only";
import { createHash } from "node:crypto";

interface Entry {
  count: number;
  resetAt: number;
}

const entries = new Map<string, Entry>();

/** Límite por proceso; Netlify puede agregar además rate limiting perimetral. */
export function allowRequest(
  scope: string,
  identifier: string,
  limit: number,
  windowMs: number,
): boolean {
  const digest = createHash("sha256").update(identifier).digest("hex");
  const key = `${scope}:${digest}`;
  const now = Date.now();
  const existing = entries.get(key);
  if (existing === undefined || existing.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (existing.count >= limit) return false;
  existing.count += 1;
  return true;
}
