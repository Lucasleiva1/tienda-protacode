"use server";

import { cookies } from "next/headers";
import { findOrCreateGoogleCustomer } from "@/features/accounts/account-service";
import { safeNextPath } from "@/features/accounts/auth-utils";
import { createCustomerSession } from "@/features/accounts/customer-session";
import {
  createGoogleNonce,
  getGoogleClientId,
  hashGoogleNonce,
  parseNonceCookie,
  serializeNonceCookie,
  verifyGoogleCredential,
  type GoogleIdentityError,
} from "@/features/accounts/google-identity";
import { linkGuestOrdersToAccount } from "@/features/accounts/guest-order-linking";
import { getLocale } from "@/i18n/server";
import { pick, type Locale } from "@/i18n/shared";
import { getClientIp } from "@/lib/security/client-ip";
import { allowPersistentRequest } from "@/lib/security/persistent-rate-limit";
import { paymentLog } from "@/lib/payments/payment-logger";

/**
 * Ingreso con Google Identity Services (botón oficial, ventana emergente).
 *
 * 1. `startGoogleSignInAction` entrega el Client ID y un nonce de un solo uso; el
 *    servidor guarda solo su hash en una cookie HttpOnly de 10 minutos.
 * 2. Google devuelve la credencial al navegador, que la manda a
 *    `signInWithGoogleAction`. El servidor valida firma, emisor, audiencia,
 *    vencimiento y nonce, y recién ahí crea la sesión propia de la tienda.
 *
 * El navegador nunca decide que el usuario ingresó: solo transporta la credencial.
 */

const NONCE_COOKIE = "pc_google_nonce";
const NONCE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 10 * 60,
};

export type GoogleSignInStart =
  | { readonly ok: true; readonly clientId: string; readonly nonce: string }
  | { readonly ok: false; readonly message: string };

export type GoogleSignInErrorCode =
  | GoogleIdentityError
  | "RATE_LIMITED"
  | "ACCOUNT_UNAVAILABLE"
  | "SESSION_UNAVAILABLE";

export type GoogleSignInResult =
  | { readonly ok: true; readonly redirectTo: string; readonly firstName: string }
  | { readonly ok: false; readonly code: GoogleSignInErrorCode; readonly message: string };

function message(code: GoogleSignInErrorCode, locale: Locale): string {
  const messages: Record<GoogleSignInErrorCode, readonly [string, string, string]> = {
    GOOGLE_NOT_CONFIGURED: [
      "El ingreso con Google todavía no está configurado.",
      "Google sign-in is not configured yet.",
      "O login com Google ainda não está configurado.",
    ],
    GOOGLE_TOKEN_INVALID: [
      "Google devolvió una credencial que no pudimos validar. Probá de nuevo.",
      "Google returned a credential we could not validate. Please try again.",
      "O Google retornou uma credencial que não conseguimos validar. Tente novamente.",
    ],
    GOOGLE_TOKEN_EXPIRED: [
      "La credencial de Google venció. Tocá el botón otra vez.",
      "The Google credential expired. Tap the button again.",
      "A credencial do Google expirou. Toque no botão novamente.",
    ],
    GOOGLE_AUDIENCE_MISMATCH: [
      "La credencial no corresponde a esta tienda. Revisá el Client ID configurado.",
      "The credential does not belong to this store. Check the configured Client ID.",
      "A credencial não corresponde a esta loja. Verifique o Client ID configurado.",
    ],
    GOOGLE_NONCE_MISMATCH: [
      "El ingreso tardó demasiado o se abrió en otra pestaña. Tocá el botón otra vez.",
      "Sign-in took too long or was opened in another tab. Tap the button again.",
      "O login demorou demais ou foi aberto em outra aba. Toque no botão novamente.",
    ],
    GOOGLE_EMAIL_NOT_VERIFIED: [
      "Tu cuenta de Google no tiene el email verificado.",
      "Your Google account email is not verified.",
      "O e-mail da sua conta Google não está verificado.",
    ],
    GOOGLE_UNAVAILABLE: [
      "No pudimos comunicarnos con Google. Probá en unos minutos.",
      "We could not reach Google. Please try again in a few minutes.",
      "Não conseguimos falar com o Google. Tente novamente em alguns minutos.",
    ],
    RATE_LIMITED: [
      "Demasiados intentos. Esperá unos minutos antes de volver a probar.",
      "Too many attempts. Wait a few minutes before trying again.",
      "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
    ],
    ACCOUNT_UNAVAILABLE: [
      "Ese email ya está vinculado a otra cuenta de Google.",
      "That email is already linked to another Google account.",
      "Esse e-mail já está vinculado a outra conta Google.",
    ],
    SESSION_UNAVAILABLE: [
      "La sesión de clientes todavía no está configurada en el servidor.",
      "Customer sessions are not configured on the server yet.",
      "A sessão de clientes ainda não está configurada no servidor.",
    ],
  };
  return pick(locale, ...messages[code]);
}

export async function startGoogleSignInAction(): Promise<GoogleSignInStart> {
  const locale = await getLocale();
  const clientId = getGoogleClientId();
  if (clientId === null) return { ok: false, message: message("GOOGLE_NOT_CONFIGURED", locale) };

  const nonce = createGoogleNonce();
  const store = await cookies();
  const pending = parseNonceCookie(store.get(NONCE_COOKIE)?.value);
  store.set(NONCE_COOKIE, serializeNonceCookie([...pending, hashGoogleNonce(nonce)]), NONCE_COOKIE_OPTIONS);
  return { ok: true, clientId, nonce };
}

export async function signInWithGoogleAction(input: {
  readonly credential: unknown;
  readonly next: unknown;
}): Promise<GoogleSignInResult> {
  const locale = await getLocale();
  const store = await cookies();
  const pending = parseNonceCookie(store.get(NONCE_COOKIE)?.value);

  const ip = await getClientIp();
  if (!(await allowPersistentRequest("google-sign-in", ip, 20, 10 * 60_000))) {
    return { ok: false, code: "RATE_LIMITED", message: message("RATE_LIMITED", locale) };
  }

  const verified = await verifyGoogleCredential({
    credential: input.credential,
    clientId: getGoogleClientId(),
    allowedNonceHashes: pending,
  });
  if (!verified.ok) {
    paymentLog("warn", "GOOGLE_SIGN_IN_REJECTED", { code: verified.error });
    return { ok: false, code: verified.error, message: message(verified.error, locale) };
  }

  // Un solo uso: el nonce consumido deja de ser válido.
  const remaining = pending.filter((hash) => hash !== verified.nonceHash);
  if (remaining.length === 0) store.delete(NONCE_COOKIE);
  else store.set(NONCE_COOKIE, serializeNonceCookie(remaining), NONCE_COOKIE_OPTIONS);

  const account = await findOrCreateGoogleCustomer({
    ...verified.identity,
    emailVerified: true,
  });
  if (account === null) {
    return { ok: false, code: "ACCOUNT_UNAVAILABLE", message: message("ACCOUNT_UNAVAILABLE", locale) };
  }
  if (!(await createCustomerSession(account.id))) {
    return { ok: false, code: "SESSION_UNAVAILABLE", message: message("SESSION_UNAVAILABLE", locale) };
  }

  try {
    await linkGuestOrdersToAccount(account);
  } catch {
    paymentLog("warn", "GUEST_ORDER_LINK_FAILED", { accountId: account.id });
  }

  const next = typeof input.next === "string" ? input.next : null;
  return { ok: true, redirectTo: safeNextPath(next), firstName: account.firstName };
}
