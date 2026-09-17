"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CopyButton } from "@/components/purchases/CopyButton";
import {
  resendDeliveryEmailAction,
  retryFulfillmentAction,
  rotatePurchaseAccessAction,
  type AdminDeliveryActionResult,
} from "@/features/admin/order-delivery-actions";

export function OrderDeliveryActions({
  orderId,
  canRetry,
  canResend,
}: {
  readonly orderId: string;
  readonly canRetry: boolean;
  readonly canResend: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [purchaseUrl, setPurchaseUrl] = useState<string | null>(null);

  function run(task: () => Promise<AdminDeliveryActionResult>, keepLink = false) {
    setMessage("");
    startTransition(async () => {
      try {
        const result = await task();
        setMessage(result.message);
        if (keepLink) {
          setPurchaseUrl(
            result.ok && result.purchasePath !== undefined
              ? `${window.location.origin}${result.purchasePath}`
              : null,
          );
        }
        router.refresh();
      } catch {
        setMessage("No se pudo conectar con el servidor. Probá de nuevo.");
      }
    });
  }

  return (
    <section className="mt-8 border border-border bg-surface p-5">
      <h2 className="eyebrow text-accent-contrast">Acciones de entrega</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Estas acciones nunca cambian el estado del pago ni fabrican una licencia: reintentar usa la misma clave
        de idempotencia, así que no se asigna una segunda.
      </p>
      <div className="mt-4 grid gap-2 sm:flex sm:flex-wrap">
        {canRetry ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => retryFulfillmentAction(orderId))}
            className="min-h-11 bg-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent-foreground disabled:opacity-50"
          >
            Reintentar asignación de licencia
          </button>
        ) : null}
        {canResend ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => resendDeliveryEmailAction(orderId))}
            className="min-h-11 border border-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground disabled:opacity-50"
          >
            Reenviar email con licencia
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => rotatePurchaseAccessAction(orderId), true)}
          className="min-h-11 border border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground disabled:opacity-50"
        >
          Generar nuevo enlace privado
        </button>
      </div>
      {purchaseUrl !== null ? (
        <div className="mt-4">
          <code className="block break-all border border-border bg-background px-3 py-2 text-xs">{purchaseUrl}</code>
          <CopyButton
            className="mt-2"
            value={purchaseUrl}
            label="Copiar enlace"
            copiedLabel="Enlace copiado"
            failedLabel="Copialo a mano."
          />
        </div>
      ) : null}
      <p aria-live="polite" className="mt-3 text-sm text-foreground">
        {pending ? "Procesando…" : message}
      </p>
    </section>
  );
}
