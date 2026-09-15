"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  confirmEmailAction,
  resendVerificationAction,
  type EmailVerificationState,
} from "@/features/accounts/auth-actions";

export function ResendVerificationButton() {
  const [state, action] = useActionState<EmailVerificationState | undefined, FormData>(
    resendVerificationAction,
    undefined,
  );
  return (
    <form action={action} className="mt-5">
      <SubmitButton idle="Reenviar email" pending="Enviando…" />
      {state ? <Feedback state={state} /> : null}
    </form>
  );
}

export function ConfirmEmailForm({ token }: { readonly token: string }) {
  const [state, action] = useActionState<EmailVerificationState | undefined, FormData>(
    confirmEmailAction,
    undefined,
  );
  return (
    <form action={action}>
      <input type="hidden" name="token" value={token} />
      <p className="text-sm leading-relaxed text-muted">
        Confirmá la dirección para habilitar las compras y proteger tu cuenta.
      </p>
      <div className="mt-6">
        <SubmitButton idle="Confirmar cuenta" pending="Confirmando…" />
      </div>
      {state ? <Feedback state={state} /> : null}
    </form>
  );
}

function SubmitButton({ idle, pending }: { readonly idle: string; readonly pending: string }) {
  const status = useFormStatus();
  return (
    <button
      type="submit"
      disabled={status.pending}
      className="bg-accent px-5 py-3 text-sm font-semibold uppercase tracking-wider text-accent-foreground hover:bg-accent-contrast disabled:cursor-wait disabled:opacity-60"
    >
      {status.pending ? pending : idle}
    </button>
  );
}

function Feedback({ state }: { readonly state: EmailVerificationState }) {
  return (
    <p
      aria-live="polite"
      className={`mt-4 border px-3 py-2 text-sm ${
        state.ok ? "border-accent/50 bg-accent/10" : "border-danger/50 bg-danger/10"
      }`}
    >
      {state.message}
    </p>
  );
}
