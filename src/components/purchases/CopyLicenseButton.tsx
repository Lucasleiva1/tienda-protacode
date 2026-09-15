"use client";

import { useState } from "react";

export function CopyLicenseButton({ licenseKey }: { readonly licenseKey: string }) {
  const [message, setMessage] = useState("");

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(licenseKey);
      setMessage("Licencia copiada.");
    } catch {
      setMessage("No pudimos copiarla automáticamente. Seleccioná la clave y copiala.");
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={copy}
        className="border border-accent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        Copiar licencia
      </button>
      <p aria-live="polite" className="text-xs text-muted">
        {message}
      </p>
    </div>
  );
}
