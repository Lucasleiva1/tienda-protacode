"use client";

import { useEffect, useRef, useState } from "react";
import { LANGUAGE_COOKIE, LOCALE_LABELS, LOCALES, type Locale } from "@/i18n/shared";

const LOCALE_NAMES: Record<Locale, string> = {
  es: "Español",
  en: "English",
  pt: "Português",
};

function saveLanguage(next: Locale) {
  document.cookie =
    LANGUAGE_COOKIE +
    "=" +
    next +
    "; Path=/; Max-Age=31536000; SameSite=Lax" +
    (window.location.protocol === "https:" ? "; Secure" : "");
}

/**
 * Selector de idioma. Todo el recuadro es el botón: antes era un `<select>` nativo
 * más chico que su borde, y un toque en el borde o el relleno solo lo enfocaba sin
 * abrir la lista.
 */
export function LanguageSelector({ locale }: { readonly locale: Locale }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  function changeLanguage(next: Locale) {
    setOpen(false);
    if (next === locale) return;
    saveLanguage(next);
    window.location.reload();
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Idioma / Language / Idioma"
        className="inline-flex h-10 items-center gap-1.5 border border-border px-3 text-xs font-semibold tracking-wide text-foreground transition-colors hover:border-accent-contrast/60"
      >
        {LOCALE_LABELS[locale]}
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-40 border border-border bg-background py-1 shadow-lg">
          {LOCALES.map((value) => (
            <button
              key={value}
              role="menuitemradio"
              aria-checked={value === locale}
              type="button"
              onClick={() => changeLanguage(value)}
              className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-surface ${
                value === locale ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              <span>{LOCALE_NAMES[value]}</span>
              <span className="text-xs font-semibold tracking-wide">{LOCALE_LABELS[value]}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
