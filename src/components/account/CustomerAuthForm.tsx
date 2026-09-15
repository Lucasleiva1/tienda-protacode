"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  loginCustomerAction,
  registerCustomerAction,
  type CustomerAuthState,
} from "@/features/accounts/auth-actions";

interface CustomerAuthFormProps {
  readonly mode: "login" | "register";
  readonly next: string;
  readonly googleReady: boolean;
  readonly googleError?: string | undefined;
}

export function CustomerAuthForm({
  mode,
  next,
  googleReady,
  googleError,
}: CustomerAuthFormProps) {
  const action = mode === "register" ? registerCustomerAction : loginCustomerAction;
  const [state, formAction] = useActionState<CustomerAuthState | undefined, FormData>(
    action,
    undefined,
  );

  return (
    <div>
      {googleReady ? (
        <Link
          href={`/api/auth/google/start?next=${encodeURIComponent(next)}`}
          className="block w-full border border-border bg-surface px-6 py-3.5 text-center text-sm font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-accent"
        >
          Continuar con Google
        </Link>
      ) : (
        <div>
          <span className="block w-full cursor-not-allowed border border-border bg-surface px-6 py-3.5 text-center text-sm font-semibold uppercase tracking-[0.08em] text-muted">
            Continuar con Google
          </span>
          <p className="mt-2 text-xs text-muted">
            Google estará disponible cuando se carguen las credenciales OAuth del sitio.
          </p>
        </div>
      )}

      {googleError !== undefined ? (
        <p className="mt-4 border border-danger/50 bg-danger/10 px-3 py-2 text-sm">
          No pudimos iniciar sesión con Google. Probá nuevamente.
        </p>
      ) : null}

      <div className="my-7 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="eyebrow">o con email</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-5" noValidate>
        <input type="hidden" name="next" value={next} />

        {mode === "register" ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <Field name="firstName" label="Nombre" autoComplete="given-name" error={state?.errors?.firstName} />
            <Field name="lastName" label="Apellido" autoComplete="family-name" error={state?.errors?.lastName} />
          </div>
        ) : null}

        <Field name="email" label="Email" type="email" autoComplete="email" error={state?.errors?.email} />
        <Field
          name="password"
          label="Contraseña"
          type="password"
          autoComplete={mode === "register" ? "new-password" : "current-password"}
          help={mode === "register" ? "Entre 10 y 128 caracteres, con letras y números." : undefined}
          error={state?.errors?.password}
        />
        {mode === "register" ? (
          <Field
            name="confirmPassword"
            label="Repetí la contraseña"
            type="password"
            autoComplete="new-password"
            error={state?.errors?.confirmPassword}
          />
        ) : null}

        {state?.message !== undefined ? (
          <p aria-live="polite" className="border border-danger/50 bg-danger/10 px-3 py-2 text-sm">
            {state.message}
          </p>
        ) : null}

        <SubmitButton mode={mode} />
      </form>

      {mode === "register" ? (
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Te enviaremos un enlace para confirmar tu email. La cuenta debe estar confirmada antes de comprar.
        </p>
      ) : null}

      <p className="mt-7 text-center text-sm text-muted">
        {mode === "register" ? "¿Ya tenés una cuenta? " : "¿Todavía no tenés cuenta? "}
        <Link
          href={`${mode === "register" ? "/cuenta/iniciar-sesion" : "/cuenta/registro"}?next=${encodeURIComponent(next)}`}
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-accent"
        >
          {mode === "register" ? "Iniciá sesión" : "Registrate"}
        </Link>
      </p>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  autoComplete,
  help,
  error,
}: {
  readonly name: string;
  readonly label: string;
  readonly type?: string;
  readonly autoComplete?: string;
  readonly help?: string;
  readonly error?: string;
}) {
  return (
    <div>
      <label htmlFor={`customer-${name}`} className="eyebrow">{label}</label>
      <input
        id={`customer-${name}`}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        aria-invalid={error !== undefined}
        className={`mt-2 w-full border bg-background px-4 py-3 text-base text-foreground focus:outline-none ${
          error === undefined ? "border-border focus:border-accent" : "border-danger"
        }`}
      />
      {error !== undefined ? <p className="mt-1.5 text-sm text-danger">{error}</p> : null}
      {help !== undefined && error === undefined ? <p className="mt-1.5 text-xs text-muted">{help}</p> : null}
    </div>
  );
}

function SubmitButton({ mode }: { readonly mode: "login" | "register" }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-accent px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors hover:bg-accent-contrast disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Procesando…" : mode === "register" ? "Crear cuenta" : "Iniciar sesión"}
    </button>
  );
}
