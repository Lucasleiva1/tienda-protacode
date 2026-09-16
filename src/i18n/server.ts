import "server-only";
import { cookies } from "next/headers";
import { LANGUAGE_COOKIE, resolveLocale, type Locale } from "./shared";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return resolveLocale(store.get(LANGUAGE_COOKIE)?.value);
}
