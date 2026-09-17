import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { OAuth2Client, type TokenPayload } from "google-auth-library";

/**
 * Google Identity Services: validación del ID token en el servidor.
 *
 * El navegador solo entrega la credencial (JWT). Acá se verifica:
 *   - firma, con los certificados públicos de Google;
 *   - emisor (`iss`): accounts.google.com;
 *   - audiencia (`aud`): el Client ID de esta tienda;
 *   - vencimiento (`exp`) y emisión (`iat`);
 *   - `nonce`: el valor de un solo uso que el servidor entregó a este navegador;
 *   - `email_verified`: Google confirmó el email.
 *
 * Solo se pide identidad básica. No hay scopes de Gmail, Drive, Calendar ni
 * contactos, y ningún token de Google se guarda después del ingreso.
 */

export const GOOGLE_ISSUERS = ["accounts.google.com", "https://accounts.google.com"] as const;

export type GoogleIdentityError =
  | "GOOGLE_NOT_CONFIGURED"
  | "GOOGLE_TOKEN_INVALID"
  | "GOOGLE_TOKEN_EXPIRED"
  | "GOOGLE_AUDIENCE_MISMATCH"
  | "GOOGLE_NONCE_MISMATCH"
  | "GOOGLE_EMAIL_NOT_VERIFIED"
  | "GOOGLE_UNAVAILABLE";

export interface VerifiedGoogleIdentity {
  readonly subject: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly avatarUrl: string | null;
}

export type GoogleIdentityResult =
  | {
      readonly ok: true;
      readonly identity: VerifiedGoogleIdentity;
      /** Nonce consumido: se quita de la cookie para que no se reutilice. */
      readonly nonceHash: string;
    }
  | { readonly ok: false; readonly error: GoogleIdentityError };

/** Verifica firma, emisor, audiencia y fechas. Devuelve el payload o lanza. */
export type GoogleIdTokenVerifier = (credential: string, audience: string) => Promise<TokenPayload>;

let client: OAuth2Client | null = null;

export const verifyWithGoogleCertificates: GoogleIdTokenVerifier = async (credential, audience) => {
  client ??= new OAuth2Client();
  const ticket = await client.verifyIdToken({ idToken: credential, audience });
  const payload = ticket.getPayload();
  if (payload === undefined) throw new Error("Wrong number of segments");
  return payload;
};

export function getGoogleClientId(): string | null {
  const value = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  // Formato oficial: <número>-<texto>.apps.googleusercontent.com
  return /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(value) ? value : null;
}

/* ---------------------------------- nonce --------------------------------- */

export function createGoogleNonce(): string {
  return randomBytes(32).toString("base64url");
}

export function hashGoogleNonce(nonce: string): string {
  return createHash("sha256").update(nonce, "utf8").digest("hex");
}

function sameText(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

/* ------------------------------- verificación ------------------------------ */

function mapVerifierError(error: unknown): GoogleIdentityError {
  // El mensaje de la librería puede incluir el token: se usa solo para clasificar.
  const message = error instanceof Error ? error.message : "";
  if (/too late/i.test(message)) return "GOOGLE_TOKEN_EXPIRED";
  if (/audience|recipient/i.test(message)) return "GOOGLE_AUDIENCE_MISMATCH";
  if (
    /segments|signature|pem found|issuer|too early|envelope|parse|json|token/i.test(message)
  ) {
    return "GOOGLE_TOKEN_INVALID";
  }
  return "GOOGLE_UNAVAILABLE";
}

function splitName(payload: TokenPayload): { firstName: string; lastName: string } {
  const full = (payload.name ?? "").trim().split(/\s+/).filter((part) => part !== "");
  const firstName = (payload.given_name ?? full[0] ?? "Cliente").trim().slice(0, 60) || "Cliente";
  const lastName =
    (payload.family_name ?? (full.slice(1).join(" ") || "Google")).trim().slice(0, 60) || "Google";
  return { firstName, lastName };
}

export async function verifyGoogleCredential(input: {
  readonly credential: unknown;
  readonly clientId: string | null;
  /** Hashes de los nonces emitidos para este navegador (cookie HttpOnly). */
  readonly allowedNonceHashes: readonly string[];
  readonly verifier?: GoogleIdTokenVerifier;
  readonly now?: number;
}): Promise<GoogleIdentityResult> {
  if (input.clientId === null) return { ok: false, error: "GOOGLE_NOT_CONFIGURED" };
  if (
    typeof input.credential !== "string" ||
    input.credential.length < 20 ||
    input.credential.length > 4096 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(input.credential)
  ) {
    return { ok: false, error: "GOOGLE_TOKEN_INVALID" };
  }

  let payload: TokenPayload;
  try {
    payload = await (input.verifier ?? verifyWithGoogleCertificates)(input.credential, input.clientId);
  } catch (error) {
    return { ok: false, error: mapVerifierError(error) };
  }

  // Controles propios, además de los de la librería.
  const now = Math.floor((input.now ?? Date.now()) / 1000);
  if (!GOOGLE_ISSUERS.includes(payload.iss as (typeof GOOGLE_ISSUERS)[number])) {
    return { ok: false, error: "GOOGLE_TOKEN_INVALID" };
  }
  if (payload.aud !== input.clientId) return { ok: false, error: "GOOGLE_AUDIENCE_MISMATCH" };
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    return { ok: false, error: "GOOGLE_TOKEN_EXPIRED" };
  }
  if (typeof payload.nonce !== "string") return { ok: false, error: "GOOGLE_NONCE_MISMATCH" };
  const receivedNonceHash = hashGoogleNonce(payload.nonce);
  let nonceMatches = false;
  for (const allowed of input.allowedNonceHashes) {
    if (sameText(receivedNonceHash, allowed)) nonceMatches = true;
  }
  if (!nonceMatches) return { ok: false, error: "GOOGLE_NONCE_MISMATCH" };
  if (typeof payload.sub !== "string" || payload.sub === "" || payload.sub.length > 255) {
    return { ok: false, error: "GOOGLE_TOKEN_INVALID" };
  }
  if (payload.email_verified !== true || typeof payload.email !== "string") {
    return { ok: false, error: "GOOGLE_EMAIL_NOT_VERIFIED" };
  }
  const email = payload.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
    return { ok: false, error: "GOOGLE_TOKEN_INVALID" };
  }

  return {
    ok: true,
    identity: {
      subject: payload.sub,
      email,
      ...splitName(payload),
      avatarUrl: typeof payload.picture === "string" ? payload.picture : null,
    },
    nonceHash: receivedNonceHash,
  };
}

/** Cookie con los hashes de nonce vigentes: hasta tres, separados por punto. */
export const MAX_PENDING_NONCES = 3;

export function parseNonceCookie(value: string | undefined): readonly string[] {
  if (value === undefined) return [];
  return value
    .split(".")
    .filter((hash) => /^[a-f0-9]{64}$/.test(hash))
    .slice(-MAX_PENDING_NONCES);
}

export function serializeNonceCookie(hashes: readonly string[]): string {
  return hashes.slice(-MAX_PENDING_NONCES).join(".");
}
