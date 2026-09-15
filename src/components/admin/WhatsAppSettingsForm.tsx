"use client";

import { useActionState } from "react";
import {
  saveWhatsAppNumberAction,
  type WhatsAppSettingsActionState,
} from "@/features/admin/settings-actions";

const INITIAL_STATE: WhatsAppSettingsActionState = { ok: null, message: "" };

export function WhatsAppSettingsForm({ number }: { readonly number: string }) {
  const [state, action, pending] = useActionState(
    saveWhatsAppNumberAction,
    INITIAL_STATE,
  );

  return (
    <form action={action} className="mt-5 border-t border-border pt-5">
      <label htmlFor="whatsapp-number" className="eyebrow">
        Número receptor
      </label>
      <p className="mt-1 text-xs leading-relaxed text-muted">
        Código de país y número completo. Podés escribir espacios, guiones o el signo +.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          id="whatsapp-number"
          name="whatsappNumber"
          type="tel"
          inputMode="tel"
          required
          defaultValue={number}
          aria-describedby="whatsapp-result"
          className="min-w-0 flex-1 border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent-foreground transition-colors hover:bg-accent-contrast disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Guardando…" : "Guardar número"}
        </button>
      </div>
      <p
        id="whatsapp-result"
        aria-live="polite"
        className={`mt-3 text-sm ${state.ok === false ? "text-danger" : "text-muted"}`}
      >
        {state.message}
      </p>
    </form>
  );
}
