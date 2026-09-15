import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { safeNextPath } from "@/features/accounts/auth-utils";
import { createGoogleOAuthClient, googleAuthOrigin } from "@/features/accounts/google-auth";

const STATE_COOKIE = "pc_google_state";
const NEXT_COOKIE = "pc_google_next";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = googleAuthOrigin(request.nextUrl.origin);
  if (origin === null) {
    return NextResponse.redirect(new URL("/cuenta/iniciar-sesion?error=google-origin", request.nextUrl.origin));
  }
  const client = createGoogleOAuthClient(origin);
  if (client === null) {
    return NextResponse.redirect(new URL("/cuenta/iniciar-sesion?error=google-config", origin));
  }

  const state = randomBytes(32).toString("base64url");
  const store = await cookies();
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };
  store.set(STATE_COOKIE, state, options);
  store.set(NEXT_COOKIE, safeNextPath(request.nextUrl.searchParams.get("next")), options);

  const url = client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    state,
  });
  return NextResponse.redirect(url);
}
