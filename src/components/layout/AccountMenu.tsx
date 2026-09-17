"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logoutCustomerAction } from "@/features/accounts/auth-actions";
import { pick, type Locale } from "@/i18n/shared";

interface AccountMenuProps {
  readonly firstName: string;
  readonly avatarUrl: string | null;
  readonly locale: Locale;
}

/** Menú de la cuenta en el encabezado (escritorio y tablet). */
export function AccountMenu({ firstName, avatarUrl, locale }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      if (root.current !== null && !root.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const initial = firstName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div ref={root} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 border border-border px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:border-accent hover:text-foreground"
      >
        {avatarUrl !== null ? (
          <Image
            src={avatarUrl}
            alt=""
            width={24}
            height={24}
            unoptimized
            referrerPolicy="no-referrer"
            className="h-6 w-6 rounded-full"
          />
        ) : (
          <span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 text-[0.7rem] text-foreground">
            {initial}
          </span>
        )}
        <span className="max-w-[9rem] truncate">
          {pick(locale, "Hola, ", "Hi, ", "Olá, ")}
          {firstName}
        </span>
      </button>

      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-52 border border-border bg-background py-1 shadow-lg">
          <Link role="menuitem" href="/cuenta" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-foreground hover:bg-surface">
            {pick(locale, "Mi cuenta", "My account", "Minha conta")}
          </Link>
          <Link role="menuitem" href="/cuenta/compras" onClick={() => setOpen(false)} className="block px-4 py-3 text-sm text-foreground hover:bg-surface">
            {pick(locale, "Mis compras", "My purchases", "Minhas compras")}
          </Link>
          <form action={logoutCustomerAction} className="border-t border-border">
            <button role="menuitem" type="submit" className="block w-full px-4 py-3 text-left text-sm text-muted hover:bg-surface hover:text-foreground">
              {pick(locale, "Cerrar sesión", "Sign out", "Sair")}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
