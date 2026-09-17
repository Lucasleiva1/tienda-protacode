import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  findCustomerById,
  incrementCustomerSessionVersion,
} from "@/features/accounts/customer-repository";
import { customerProfile } from "@/features/accounts/account-service";
import type { CustomerAccount, CustomerProfile } from "@/types/customer-account";

/**
 * Sesión propia de la tienda.
 *
 * Cookie firmada con HMAC, `HttpOnly` (el JavaScript de la página no la lee),
 * `SameSite=Lax` y `Secure` en producción. Contiene solo el id interno, el
 * vencimiento y la versión de sesión de la cuenta; nunca el token de Google.
 *
 * Cerrar sesión incrementa la versión guardada en la cuenta: cualquier cookie
 * anterior deja de valer en el servidor aunque alguien la haya copiado.
 */

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

interface SessionPayload {
  readonly id: string;
  readonly exp: number;
  readonly v: number;
}

export function encodeCustomerSession(payload: SessionPayload, secret: string): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded, secret)}`;
}

export function decodeCustomerSession(
  value: string,
  secret: string,
  now: number = Date.now(),
): SessionPayload | null {
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
      v?: unknown;
    };
    if (typeof parsed.id !== "string" || typeof parsed.exp !== "number" || parsed.exp <= now) {
      return null;
    }
    // Las cookies anteriores a la versión de sesión equivalen a la versión 0.
    const version = parsed.v === undefined ? 0 : parsed.v;
    if (typeof version !== "number" || !Number.isSafeInteger(version)) return null;
    return { id: parsed.id, exp: parsed.exp, v: version };
  } catch {
    return null;
  }
}

/** La sesión vale solo si la cuenta existe y su versión coincide. */
export function sessionMatchesAccount(
  session: SessionPayload,
  account: CustomerAccount | null,
): account is CustomerAccount {
  return account !== null && account.id === session.id && account.sessionVersion === session.v;
}

export async function createCustomerSession(accountId: string): Promise<boolean> {
  const secret = sessionSecret();
  if (secret === null) return false;
  const account = await findCustomerById(accountId);
  if (account === null) return false;

  const value = encodeCustomerSession(
    { id: account.id, exp: Date.now() + DURATION_SECONDS * 1000, v: account.sessionVersion },
    secret,
  );

  (await cookies()).set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURATION_SECONDS,
  });
  return true;
}

async function currentSession(): Promise<SessionPayload | null> {
  const secret = sessionSecret();
  const value = (await cookies()).get(COOKIE)?.value;
  if (secret === null || value === undefined) return null;
  return decodeCustomerSession(value, secret);
}

/** Cierra la sesión en el navegador y la invalida en el servidor. */
export async function destroyCustomerSession(): Promise<void> {
  const session = await currentSession();
  if (session !== null) {
    const account = await findCustomerById(session.id);
    if (sessionMatchesAccount(session, account)) {
      await incrementCustomerSessionVersion(account.id);
    }
  }
  (await cookies()).delete(COOKIE);
}

export async function getCurrentCustomerAccount(): Promise<CustomerAccount | null> {
  const session = await currentSession();
  if (session === null) return null;
  const account = await findCustomerById(session.id);
  return sessionMatchesAccount(session, account) ? account : null;
}

export async function getCurrentCustomerProfile(): Promise<CustomerProfile | null> {
  const account = await getCurrentCustomerAccount();
  return account === null ? null : customerProfile(account);
}
