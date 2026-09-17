"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestOrderAccessEmailAction,
  type RecoveryState,
} from "@/features/purchases/recovery-actions";
import { pick, type Locale } from "@/i18n/shared";

const INITIAL: RecoveryState = { ok: null, message: "" };

export function RecoveryForm({ locale }: { readonly locale: Locale }) {
  const [state, action, pending] = useActionState(requestOrderAccessEmailAction, INITIAL);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="recuperar-email" className="eyebrow">
          {pick(locale, "Email de la compra", "Purchase email", "E-mail da compra")}
        </label>
        <input
          id="recuperar-email"
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="email"
          className="mt-2 w-full border border-border bg-background px-4 py-3 text-base text-foreground focus:border-accent focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="recuperar-pedido" className="eyebrow">
          {pick(locale, "Número de pedido", "Order number", "Número do pedido")}
        </label>
        <input
          id="recuperar-pedido"
          name="reference"
          type="text"
          required
          maxLength={20}
          placeholder="PC-1051"
          autoCapitalize="characters"
          className="mt-2 w-full border border-border bg-background px-4 py-3 text-base uppercase text-foreground focus:border-accent focus:outline-none"
        />
      </div>

      {state.message !== "" ? (
        <p
          aria-live="polite"
          className={`border px-3 py-2 text-sm ${state.ok ? "border-accent/50 bg-accent/10" : "border-danger/50 bg-danger/10"}`}
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-accent px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors hover:bg-accent-contrast disabled:cursor-wait disabled:opacity-60"
      >
        {pending
          ? pick(locale, "Enviando…", "Sending…", "Enviando…")
          : pick(locale, "Enviarme el enlace", "Send me the link", "Enviar o link")}
      </button>

      <p className="text-center text-sm text-muted">
        {pick(locale, "¿Compraste con tu cuenta? ", "Bought with your account? ", "Comprou com sua conta? ")}
        <Link href="/cuenta/compras" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-accent">
          {pick(locale, "Mis compras", "My purchases", "Minhas compras")}
        </Link>
      </p>
    </form>
  );
}
