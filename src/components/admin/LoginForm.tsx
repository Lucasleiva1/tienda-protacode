"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type LoginResult } from "@/features/admin/login-actions";

interface LoginFormProps {
  /** Solo en desarrollo: credenciales de prueba precargadas. En producción llegan vacías. */
  readonly devEmail?: string;
  readonly devPassword?: string;
}

export function LoginForm({ devEmail, devPassword }: LoginFormProps = {}) {
  const [estado, accion] = useActionState<LoginResult, FormData>(
    loginAction,
    undefined,
  );

  return (
    <form action={accion} className="space-y-5">
      <div>
        <label htmlFor="admin-email" className="eyebrow">
          Email
        </label>
        <input
          id="admin-email"
          name="email"
          type="email"
          required
          maxLength={254}
          defaultValue={devEmail}
          autoComplete="username"
          aria-invalid={estado !== undefined}
          aria-describedby={estado !== undefined ? "admin-error" : undefined}
          className="mt-2 w-full border border-border bg-background px-4 py-3 text-base text-foreground focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="admin-password" className="eyebrow">
          Contraseña
        </label>
        <input
          id="admin-password"
          name="password"
          type="password"
          required
          maxLength={128}
          defaultValue={devPassword}
          autoComplete="current-password"
          aria-invalid={estado !== undefined}
          aria-describedby={estado !== undefined ? "admin-error" : undefined}
          className="mt-2 w-full border border-border bg-background px-4 py-3 text-base text-foreground focus:border-accent focus:outline-none"
        />
      </div>

      <div aria-live="polite">
        {estado !== undefined ? (
          <p
            id="admin-error"
            className="border border-danger/50 bg-danger/10 px-3 py-2 text-sm text-foreground"
          >
            ⚠ {estado.error}
          </p>
        ) : null}
      </div>

      <Boton />
    </form>
  );
}

/** Botón con estado de envío. Se apaga solo mientras el servidor responde. */
function Boton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full bg-accent px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors hover:bg-accent-contrast disabled:cursor-wait disabled:border disabled:border-border disabled:bg-transparent disabled:text-muted"
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}
