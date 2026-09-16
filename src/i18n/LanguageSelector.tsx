"use client";

import { LANGUAGE_COOKIE, LOCALE_LABELS, LOCALES, resolveLocale, type Locale } from "@/i18n/shared";

export function LanguageSelector({ locale }: { readonly locale: Locale }) {
  function changeLanguage(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = resolveLocale(event.target.value);
    if (next === locale) return;
    document.cookie =
      LANGUAGE_COOKIE +
      "=" +
      next +
      "; Path=/; Max-Age=31536000; SameSite=Lax" +
      (window.location.protocol === "https:" ? "; Secure" : "");
    window.location.reload();
  }

  return (
    <label className="inline-flex h-10 items-center border border-border px-2 text-xs font-semibold tracking-wide text-foreground transition-colors hover:border-accent-contrast/60">
      <span className="sr-only">Idioma / Language / Idioma</span>
      <select
        value={locale}
        onChange={changeLanguage}
        aria-label="Idioma / Language / Idioma"
        className="cursor-pointer bg-background text-foreground outline-none"
      >
        {LOCALES.map((value) => (
          <option key={value} value={value}>
            {LOCALE_LABELS[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
