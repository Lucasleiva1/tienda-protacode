import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { findCustomerById } from "@/features/accounts/customer-repository";
import { customerProfile } from "@/features/accounts/account-service";
import type { CustomerAccount, CustomerProfile } from "@/types/customer-account";

const COOKIE = "pc_customer";
const DURATION_SECONDS = 7 * 24 * 60 * 60;

function sessionSecret(): string | null {
  const explicit = process.env.CUSTOMER_SESSION_SECRET?.trim();
  if (explicit !== undefined && explicit.length >= 32) return explicit;

  const admin = process.env.ADMIN_SESSION_SECRET?.trim();
  if (admin === undefined || admin.length < 32) return null;
  return createHmac("sha256", admin).update("prota-code-customer-session-v1").digest("hex");
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export async function createCustomerSession(accountId: string): Promise<boolean> {
  const secret = sessionSecret();
  if (secret === null) return false;

  const payload = Buffer.from(
    JSON.stringify({ id: accountId, exp: Date.now() + DURATION_SECONDS * 1000 }),
  ).toString("base64url");
  const value = `${payload}.${sign(payload, secret)}`;

  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURATION_SECONDS,
  });
  return true;
}

export async function destroyCustomerSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

async function sessionAccountId(): Promise<string | null> {
  const secret = sessionSecret();
  const value = (await cookies()).get(COOKIE)?.value;
  if (secret === null || value === undefined) return null;

  const split = value.lastIndexOf(".");
  if (split <= 0) return null;
  const payload = value.slice(0, split);
  const received = value.slice(split + 1);
  const expected = sign(payload, secret);
  if (received.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      id?: unknown;
      exp?: unknown;
    };
    return typeof parsed.id === "string" &&
      typeof parsed.exp === "number" &&
      parsed.exp > Date.now()
      ? parsed.id
      : null;
  } catch {
    return null;
  }
}

export async function getCurrentCustomerAccount(): Promise<CustomerAccount | null> {
  const id = await sessionAccountId();
  return id === null ? null : findCustomerById(id);
}

export async function getCurrentCustomerProfile(): Promise<CustomerProfile | null> {
  const account = await getCurrentCustomerAccount();
  return account === null ? null : customerProfile(account);
}
