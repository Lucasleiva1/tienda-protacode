import "server-only";

import { OAuth2Client } from "google-auth-library";

export interface GoogleAuthConfiguration {
  readonly ready: boolean;
  readonly clientId: string | null;
  readonly clientSecret: string | null;
}

export function getGoogleAuthConfiguration(): GoogleAuthConfiguration {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || null;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || null;
  return { ready: clientId !== null && clientSecret !== null, clientId, clientSecret };
}

export function googleRedirectUri(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/auth/google/callback`;
}

export function googleAuthOrigin(requestOrigin: string): string | null {
  const configured = process.env.PUBLIC_SITE_URL?.trim() || process.env.URL?.trim();
  const candidate = configured || (process.env.NODE_ENV === "development" ? requestOrigin : "");
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && process.env.NODE_ENV !== "development") return null;
    if (process.env.NODE_ENV === "development" && !["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

export function createGoogleOAuthClient(origin: string): OAuth2Client | null {
  const config = getGoogleAuthConfiguration();
  if (!config.ready || config.clientId === null || config.clientSecret === null) return null;
  return new OAuth2Client(config.clientId, config.clientSecret, googleRedirectUri(origin));
}
