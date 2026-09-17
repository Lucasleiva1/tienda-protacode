"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { DownloadIcon } from "@/components/ui/Icons";
import {
  claimFreeLicenseAction,
  type FreeLicenseActionResult,
} from "@/features/checkout/free-license-actions";
import { pick, type Locale } from "@/i18n/shared";

/**
 * Programa gratuito que lleva licencia: se obtiene con la cuenta, sin pagar.
 * El servidor entrega una sola licencia por cuenta.
 */
export function FreeLicenseButton({
  slug,
  locale,
}: {
  readonly slug: string;
  readonly locale: Locale;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<Extract<FreeLicenseActionResult, { ok: false }> | null>(null);
  const busy = useRef(false);

  function claim() {
    if (busy.current) return;
    busy.current = true;
    setResult(null);
    startTransition(async () => {
      try {
        const response = await claimFreeLicenseAction(slug);
        if (response.ok) {
          window.location.assign(response.redirectTo);
          return;
        }
        setResult(response);
      } catch {
        setResult({
          ok: false,
          message: pick(locale, "No pudimos conectar con el servidor. Probá de nuevo.", "We could not reach the server. Try again.", "Não foi possível conectar ao servidor. Tente novamente."),
        });
      }
      busy.current = false;
    });
  }

  return (
    <div>
      <button
        type="button"
        onClick={claim}
        disabled={pending}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 bg-accent px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast disabled:cursor-wait disabled:opacity-60 sm:w-auto"
      >
        <DownloadIcon className="h-4 w-4" />
        {pending
          ? pick(locale, "Preparando…", "Preparing…", "Preparando…")
          : pick(locale, "Obtener licencia gratis", "Get free license", "Obter licença grátis")}
      </button>
      {result !== null ? (
        <p aria-live="polite" className="mt-3 border border-danger/50 bg-danger/10 px-3 py-2 text-sm">
          {result.message}{" "}
          {result.signInHref !== undefined ? (
            <Link href={result.signInHref} className="underline underline-offset-4">
              {pick(locale, "Continuar", "Continue", "Continuar")}
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
