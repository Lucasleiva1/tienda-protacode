"use client";

import { useState, useTransition } from "react";
import { revealLicenseAction } from "@/features/admin/order-delivery-actions";

export function RevealLicenseButton({
  orderId,
  productId,
}: {
  readonly orderId: string;
  readonly productId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [licenseKey, setLicenseKey] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  function reveal(): void {
    startTransition(async () => {
      const result = await revealLicenseAction(orderId, productId);
      setMessage(result.message);
      setLicenseKey(result.ok ? result.licenseKey ?? null : null);
    });
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={reveal}
        className="border border-border px-3 py-2 text-xs uppercase tracking-wider text-foreground disabled:opacity-50"
      >
        {pending ? "Verificando…" : "Mostrar licencia"}
      </button>
      {licenseKey !== null ? (
        <code className="mt-2 block select-all break-all border border-border bg-background px-3 py-2 text-xs">
          {licenseKey}
        </code>
      ) : null}
      <p aria-live="polite" className="mt-1 text-xs text-muted">{message}</p>
    </div>
  );
}
