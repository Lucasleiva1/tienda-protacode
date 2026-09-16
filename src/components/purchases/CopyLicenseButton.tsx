"use client";

import { useState } from "react";
import { pick, type Locale } from "@/i18n/shared";

export function CopyLicenseButton({
  licenseKey,
  locale,
}: {
  readonly licenseKey: string;
  readonly locale: Locale;
}) {
  const [message, setMessage] = useState("");

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(licenseKey);
      setMessage(pick(locale, "Licencia copiada.", "License copied.", "Licença copiada."));
    } catch {
      setMessage(
        pick(
          locale,
          "No pudimos copiarla automáticamente. Seleccioná la clave y copiala.",
          "We could not copy it automatically. Select the key and copy it.",
          "Não foi possível copiar automaticamente. Selecione a chave e copie.",
        ),
      );
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={copy}
        className="border border-accent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {pick(locale, "Copiar licencia", "Copy license", "Copiar licença")}
      </button>
      <p aria-live="polite" className="text-xs text-muted">
        {message}
      </p>
    </div>
  );
}
