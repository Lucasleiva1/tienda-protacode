export const LANGUAGE_COOKIE = "prota-code-language";

export const LOCALES = ["es", "en", "pt"] as const;

export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  es: "ES",
  en: "EN",
  pt: "PT",
};

export function resolveLocale(value: string | null | undefined): Locale {
  return value === "en" || value === "pt" ? value : "es";
}

export function pick<T>(locale: Locale, spanish: T, english: T, portuguese: T): T {
  if (locale === "en") return english;
  if (locale === "pt") return portuguese;
  return spanish;
}

export function documentLanguage(locale: Locale): string {
  return pick(locale, "es-AR", "en", "pt-BR");
}

export function numberLocale(locale: Locale): string {
  return pick(locale, "es-AR", "en-US", "pt-BR");
}

export function navigationLabel(locale: Locale, spanish: string): string {
  if (locale === "es") return spanish;
  const names: Record<string, readonly [string, string]> = {
    Inicio: ["Home", "Início"],
    Programas: ["Programs", "Programas"],
    Soporte: ["Support", "Suporte"],
  };
  const translated = names[spanish];
  if (translated === undefined) return spanish;
  return locale === "en" ? translated[0] : translated[1];
}
