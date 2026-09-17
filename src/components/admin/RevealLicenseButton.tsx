"use client";

import { useState, useTransition } from "react";
import { CopyButton } from "@/components/purchases/CopyButton";
import {
  revealLicenseAction,
  verifyLicenseAction,
} from "@/features/admin/order-delivery-actions";

/**
 * Licencia de un ítem en el Admin: se revela solo a pedido (acción protegida) y,
 * si el proveedor lo permite, se verifica contra el sistema de licencias.
 */
export function RevealLicenseButton({
  orderId,
  productId,
  canVerify,
}: {
  readonly orderId: string;
  readonly productId: string;
  readonly canVerify: boolean;
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

  function verify(): void {
    startTransition(async () => {
      const result = await verifyLicenseAction(orderId, productId);
      setMessage(`${result.ok ? "✔" : "⚠"} ${result.message}`);
    });
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={reveal}
          className="min-h-10 border border-border px-3 py-2 text-xs uppercase tracking-wider text-foreground disabled:opacity-50"
        >
          {pending ? "Verificando…" : "Mostrar licencia"}
        </button>
        {canVerify ? (
          <button
            type="button"
            disabled={pending}
            onClick={verify}
            className="min-h-10 border border-border px-3 py-2 text-xs uppercase tracking-wider text-foreground disabled:opacity-50"
          >
            Verificar en el sistema de licencias
          </button>
        ) : null}
      </div>
      {licenseKey !== null ? (
        <>
          <code className="mt-2 block select-all break-all border border-border bg-background px-3 py-2 text-xs">
            {licenseKey}
          </code>
          <CopyButton
            className="mt-2"
            value={licenseKey}
            label="Copiar licencia"
            copiedLabel="Copiada"
            failedLabel="Copiala a mano."
          />
        </>
      ) : null}
      <p aria-live="polite" className="mt-1 text-xs text-muted">{message}</p>
    </div>
  );
}
