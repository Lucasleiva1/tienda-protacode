"use client";

import { useState, useTransition } from "react";
import {
  retryFulfillmentAction,
  rotatePurchaseAccessAction,
} from "@/features/admin/order-delivery-actions";

export function OrderDeliveryActions({
  orderId,
  canRetry,
}: {
  readonly orderId: string;
  readonly canRetry: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [purchasePath, setPurchasePath] = useState<string | null>(null);

  function retry(): void {
    setMessage("");
    startTransition(async () => {
      const result = await retryFulfillmentAction(orderId);
      setMessage(result.message);
    });
  }

  function rotate(): void {
    setMessage("");
    startTransition(async () => {
      const result = await rotatePurchaseAccessAction(orderId);
      setMessage(result.message);
      setPurchasePath(result.ok ? result.purchasePath ?? null : null);
    });
  }

  async function copyAccess(): Promise<void> {
    if (purchasePath === null) return;
    await navigator.clipboard.writeText(`${window.location.origin}${purchasePath}`);
    setMessage("Enlace de compra copiado.");
  }

  return (
    <section className="mt-8 border border-border bg-surface p-5">
      <h2 className="eyebrow text-accent-contrast">Acciones de entrega</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Estas acciones nunca cambian el estado del pago ni fabrican una licencia.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        {canRetry ? (
          <button
            type="button"
            disabled={pending}
            onClick={retry}
            className="bg-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent-foreground disabled:opacity-50"
          >
            Reintentar entrega
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={rotate}
          className="border border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground disabled:opacity-50"
        >
          Generar nuevo acceso
        </button>
        {purchasePath !== null ? (
          <button
            type="button"
            onClick={copyAccess}
            className="border border-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground"
          >
            Copiar nuevo enlace
          </button>
        ) : null}
      </div>
      {purchasePath !== null ? (
        <code className="mt-4 block break-all border border-border bg-background px-3 py-2 text-xs">
          {purchasePath}
        </code>
      ) : null}
      <p aria-live="polite" className="mt-3 text-sm text-muted">{message}</p>
    </section>
  );
}
