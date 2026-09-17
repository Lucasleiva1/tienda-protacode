import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { findOrCreateGoogleCustomer } from "@/features/accounts/account-service";
import { createCustomerSession } from "@/features/accounts/customer-session";
import {
  createGoogleOAuthClient,
  getGoogleAuthConfiguration,
  googleAuthOrigin,
} from "@/features/accounts/google-auth";
import { safeNextPath } from "@/features/accounts/auth-utils";
import { linkGuestOrdersToAccount } from "@/features/accounts/guest-order-linking";

const STATE_COOKIE = "pc_google_state";
const NEXT_COOKIE = "pc_google_next";

function sameState(received: string | null, expected: string | undefined): boolean {
  if (received === null || expected === undefined || received.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

function failure(origin: string, code: string): NextResponse {
  return NextResponse.redirect(new URL(`/cuenta/iniciar-sesion?error=${code}`, origin));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = googleAuthOrigin(request.nextUrl.origin);
  if (origin === null) {
    return failure(request.nextUrl.origin, "google-origin");
  }
  const store = await cookies();
  const state = request.nextUrl.searchParams.get("state");
  const expected = store.get(STATE_COOKIE)?.value;
  const next = store.get(NEXT_COOKIE)?.value ?? "/cuenta";
  store.delete(STATE_COOKIE);
  store.delete(NEXT_COOKIE);

  if (!sameState(state, expected)) return failure(origin, "google-state");
  if (request.nextUrl.searchParams.has("error")) return failure(origin, "google-cancelled");

  const code = request.nextUrl.searchParams.get("code");
  const client = createGoogleOAuthClient(origin);
  const config = getGoogleAuthConfiguration();
  if (code === null || client === null || config.clientId === null) {
    return failure(origin, "google-config");
  }
  const clientId = config.clientId;

  try {
    const { tokens } = await client.getToken(code);
    if (typeof tokens.id_token !== "string") return failure(origin, "google-token");
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: clientId,
    });
    const payload = ticket.getPayload();
    if (
      payload?.sub === undefined ||
      payload.email === undefined ||
      payload.email_verified !== true
    ) {
      return failure(origin, "google-profile");
    }

    const fullName = (payload.name ?? "Cliente").trim().split(/\s+/);
    const firstName = (payload.given_name ?? fullName[0] ?? "Cliente").trim();
    const lastName = (payload.family_name ?? (fullName.slice(1).join(" ") || "Google")).trim();
    const account = await findOrCreateGoogleCustomer({
      subject: payload.sub,
      email: payload.email,
      firstName,
      lastName,
      emailVerified: true,
      avatarUrl: payload.picture ?? null,
    });
    if (account === null || !(await createCustomerSession(account.id))) {
      return failure(origin, "google-account");
    }
    await linkGuestOrdersToAccount(account).catch(() => 0);

    return NextResponse.redirect(new URL(safeNextPath(next), origin));
  } catch {
    return failure(origin, "google-error");
  }
}
