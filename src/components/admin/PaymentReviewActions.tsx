"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  confirmPaymentAction,
  rejectPaymentAction,
  type AdminDeliveryActionResult,
} from "@/features/admin/order-delivery-actions";

interface PaymentReviewActionsProps {
  readonly orderId: string;
  readonly reference: string;
  readonly product: string;
  readonly amount: string;
  readonly method: string;
}

/**
 * Confirmar / rechazar un pago manual.
 *
 * La confirmación pide una segunda decisión explícita en una ventana modal. La
 * operación real ocurre en el servidor y es idempotente: un doble toque o una
 * recarga no generan otra licencia.
 */
export function PaymentReviewActions({ orderId, reference, product, amount, method }: PaymentReviewActionsProps) {
  const router = useRouter();
  const confirmDialog = useRef<HTMLDialogElement | null>(null);
  const rejectDialog = useRef<HTMLDialogElement | null>(null);
  const busy = useRef(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<AdminDeliveryActionResult | null>(null);
  const [reason, setReason] = useState("");

  function run(dialog: HTMLDialogElement | null, task: () => Promise<AdminDeliveryActionResult>) {
    if (busy.current) return;
    busy.current = true;
    setResult(null);
    startTransition(async () => {
      try {
        const response = await task();
        setResult(response);
        dialog?.close();
        router.refresh();
      } catch {
        setResult({
          ok: false,
          message: "No se pudo conectar con el servidor. Revisá la conexión: si la operación ya se hizo, repetirla no la duplica.",
        });
      } finally {
        busy.current = false;
      }
    });
  }

  const summary = (
    <dl className="mt-4 divide-y divide-border border border-border">
      <Row label="Pedido" value={reference} />
      <Row label="Producto" value={product} />
      <Row label="Importe" value={amount} strong />
      <Row label="Método" value={method} />
    </dl>
  );

  return (
    <div>
      <div className="grid gap-2 sm:flex sm:flex-wrap">
        <button
          type="button"
          disabled={pending}
          onClick={() => confirmDialog.current?.showModal()}
          className="min-h-12 bg-accent px-6 py-3 text-sm font-semibold uppercase tracking-wider text-accent-foreground transition-colors hover:bg-accent-contrast disabled:opacity-50"
        >
          Confirmar pago
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => rejectDialog.current?.showModal()}
          className="min-h-12 border border-danger/70 px-6 py-3 text-sm font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-danger/15 disabled:opacity-50"
        >
          Rechazar
        </button>
      </div>

      {result !== null ? (
        <p
          role="status"
          className={`mt-4 border px-4 py-3 text-sm ${result.ok ? "border-accent/60 bg-accent/10" : "border-danger/60 bg-danger/10"}`}
        >
          {result.message}
        </p>
      ) : null}

      <dialog
        ref={confirmDialog}
        aria-labelledby="confirmar-titulo"
        className="m-auto w-[min(92vw,28rem)] border border-border bg-background p-0 text-foreground backdrop:bg-black/70"
      >
        <div className="p-5 sm:p-6">
          <h2 id="confirmar-titulo" className="display text-2xl">
            ¿Confirmás que verificaste personalmente el ingreso del dinero?
          </h2>
          {summary}
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Al confirmar se asigna la licencia y se habilita la descarga. No confíes solo en el comprobante: revisá
            el movimiento en Prex, Ualá o tu banco.
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => confirmDialog.current?.close()}
              className="min-h-12 border border-border px-4 py-3 text-sm font-semibold uppercase tracking-wider"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(confirmDialog.current, () => confirmPaymentAction(orderId))}
              className="min-h-12 bg-accent px-4 py-3 text-sm font-semibold uppercase tracking-wider text-accent-foreground disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? "Confirmando…" : "Sí, confirmar pago"}
            </button>
          </div>
        </div>
      </dialog>

      <dialog
        ref={rejectDialog}
        aria-labelledby="rechazar-titulo"
        className="m-auto w-[min(92vw,28rem)] border border-border bg-background p-0 text-foreground backdrop:bg-black/70"
      >
        <div className="p-5 sm:p-6">
          <h2 id="rechazar-titulo" className="display text-2xl">
            ¿Rechazar el pago de este pedido?
          </h2>
          {summary}
          <label htmlFor="motivo-rechazo" className="eyebrow mt-4 block">
            Motivo para el cliente (opcional)
          </label>
          <textarea
            id="motivo-rechazo"
            value={reason}
            maxLength={300}
            rows={3}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Ej.: no encontramos una transferencia por ese importe."
            className="mt-2 w-full border border-border bg-surface px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
          />
          <p className="mt-2 text-xs text-muted">El pedido queda cerrado y no se entrega nada.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => rejectDialog.current?.close()}
              className="min-h-12 border border-border px-4 py-3 text-sm font-semibold uppercase tracking-wider"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(rejectDialog.current, () => rejectPaymentAction(orderId, reason))}
              className="min-h-12 bg-danger px-4 py-3 text-sm font-semibold uppercase tracking-wider text-white disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? "Rechazando…" : "Sí, rechazar"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

function Row({ label, value, strong = false }: { readonly label: string; readonly value: string; readonly strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3 py-2.5">
      <dt className="eyebrow">{label}</dt>
      <dd className={`min-w-0 break-words text-right ${strong ? "display text-2xl" : "text-sm"}`}>{value}</dd>
    </div>
  );
}
