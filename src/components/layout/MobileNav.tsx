"use client";

import Link from "next/link";
import { useState } from "react";
import { CloseIcon, MenuIcon } from "@/components/ui/Icons";
import { logoutCustomerAction } from "@/features/accounts/auth-actions";
import { pick, type Locale } from "@/i18n/shared";
import type { NavItem } from "@/config/site";

interface MobileNavProps {
  readonly items: readonly NavItem[];
  readonly locale: Locale;
  /** "Hola, Nombre" con sesión iniciada; `null` sin sesión. */
  readonly greeting?: string | null;
}

export function MobileNav({ items, locale, greeting = null }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="menu-movil"
        className="flex h-10 w-10 items-center justify-center border border-border text-muted transition-colors hover:border-accent-contrast/60 hover:text-foreground"
      >
        {open ? <CloseIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
        <span className="sr-only">
          {open ? pick(locale, "Cerrar menú", "Close menu", "Fechar menu") : pick(locale, "Abrir menú", "Open menu", "Abrir menu")}
        </span>
      </button>

      {open ? (
        <nav
          id="menu-movil"
          aria-label={pick(locale, "Principal", "Main", "Principal")}
          className="absolute inset-x-0 top-16 border-b border-border bg-background"
        >
          <ul className="mx-auto max-w-[1400px] px-4 py-2 sm:px-6">
            {greeting !== null ? (
              <li className="border-b border-border/60 py-3 text-sm text-accent-contrast">{greeting}</li>
            ) : null}
            {items.map((item) => (
              <li key={item.href} className="border-b border-border/60 last:border-0">
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block py-4 text-base text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {greeting !== null ? (
              <li>
                <form action={logoutCustomerAction}>
                  <button type="submit" className="block w-full py-4 text-left text-base text-muted">
                    {pick(locale, "Cerrar sesión", "Sign out", "Sair")}
                  </button>
                </form>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
