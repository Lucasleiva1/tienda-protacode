"use client";

import Link from "next/link";
import { useState } from "react";
import { CloseIcon, MenuIcon } from "@/components/ui/Icons";
import type { NavItem } from "@/config/site";

interface MobileNavProps {
  readonly items: readonly NavItem[];
}

/**
 * Menú de navegación en pantallas chicas.
 *
 * Es lo único de la Home que necesita JavaScript, y por una razón concreta: el panel
 * tiene que cerrarse solo cuando se toca un enlace. Con `<details>` quedaría abierto
 * después de saltar a la sección.
 */
export function MobileNav({ items }: MobileNavProps) {
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
        {open ? (
          <CloseIcon className="h-5 w-5" />
        ) : (
          <MenuIcon className="h-5 w-5" />
        )}
        <span className="sr-only">{open ? "Cerrar menú" : "Abrir menú"}</span>
      </button>

      {open ? (
        <nav
          id="menu-movil"
          aria-label="Principal"
          className="absolute inset-x-0 top-16 border-b border-border bg-background"
        >
          <ul className="mx-auto max-w-[1400px] px-4 py-2 sm:px-6">
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
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
