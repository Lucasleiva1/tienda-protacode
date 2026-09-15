"use client";

import Link from "next/link";
import { CartIcon } from "@/components/ui/Icons";
import { useCartCount, useCartHydrated } from "@/features/cart/cart-store";

/**
 * Acceso al carrito en el header.
 *
 * El contador solo aparece cuando hay algo. Mientras no se leyó `localStorage` se
 * dibuja sin número, igual que en el servidor: eso es lo que evita el parpadeo y el
 * error de hidratación.
 */
export function CartLink() {
  const hidratado = useCartHydrated();
  const cantidad = useCartCount();
  const visible = hidratado && cantidad > 0;

  const etiqueta = !hidratado
    ? "Carrito"
    : cantidad === 0
      ? "Carrito vacío"
      : cantidad === 1
        ? "Carrito, 1 programa"
        : `Carrito, ${cantidad} programas`;

  return (
    <Link
      href="/carrito"
      aria-label={etiqueta}
      className="relative flex h-10 w-10 items-center justify-center border border-border text-muted transition-colors hover:border-accent-contrast/60 hover:text-foreground"
    >
      <CartIcon className="h-5 w-5" />

      {visible ? (
        <span
          aria-hidden="true"
          className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center bg-accent px-1 text-[0.6875rem] font-semibold leading-none text-accent-foreground"
        >
          {cantidad}
        </span>
      ) : null}
    </Link>
  );
}
