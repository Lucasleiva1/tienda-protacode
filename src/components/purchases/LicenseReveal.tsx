"use client";

import { useState } from "react";
import { CopyButton } from "@/components/purchases/CopyButton";
import { pick, type Locale } from "@/i18n/shared";

/**
 * Licencia del comprador: oculta hasta tocar "Ver licencia", para que no quede a la
 * vista en una pantalla compartida. El servidor solo la envía a quien tiene acceso.
 */
export function LicenseReveal({
  licenseKey,
  locale,
}: {
  readonly licenseKey: string;
  readonly locale: Locale;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <p className="eyebrow">{pick(locale, "Licencia", "License", "Licença")}</p>
      <code
        aria-live="polite"
        className="mt-2 block min-h-12 select-all break-all border border-border bg-background px-4 py-3 text-sm text-foreground"
      >
        {visible ? licenseKey : "•••• •••• •••• ••••"}
      </code>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-pressed={visible}
          className="min-h-10 border border-border px-4 py-2 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-accent"
        >
          {visible
            ? pick(locale, "Ocultar licencia", "Hide license", "Ocultar licença")
            : pick(locale, "Ver licencia", "View license", "Ver licença")}
        </button>
        <CopyButton
          value={licenseKey}
          label={pick(locale, "Copiar licencia", "Copy license", "Copiar licença")}
          copiedLabel={pick(locale, "Licencia copiada", "License copied", "Licença copiada")}
          failedLabel={pick(locale, "No se pudo copiar. Mostrala y copiala a mano.", "Could not copy. Show it and copy it manually.", "Não foi possível copiar. Mostre e copie manualmente.")}
        />
      </div>
    </div>
  );
}
