"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowIcon, CartIcon } from "@/components/ui/Icons";
import { useCartStore, useIsInCart } from "@/features/cart/cart-store";
import { pick, type Locale } from "@/i18n/shared";
import type { Product } from "@/types/product";

interface AddToCartButtonProps {
  readonly product: Product;
  readonly className?: string;
  readonly compact?: boolean;
  /** Estilo de borde, para cuando "Comprar" es la acción principal. */
  readonly secondary?: boolean;
  readonly locale?: Locale;
}

const MS_CONFIRMACION = 2200;

export function AddToCartButton({
  product,
  className = "",
  compact = false,
  secondary = false,
  locale = "es",
}: AddToCartButtonProps) {
  const inCart = useIsInCart(product.slug);
  const addItem = useCartStore((state) => state.addItem);
  const [confirming, setConfirming] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  function add() {
    addItem(product.slug);
    setConfirming(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setConfirming(false), MS_CONFIRMACION);
  }

  const alreadyThere = inCart && !confirming;
  const label = confirming
    ? pick(locale, "Agregado", "Added", "Adicionado")
    : alreadyThere
      ? compact
        ? pick(locale, "En carrito", "In cart", "No carrinho")
        : pick(locale, "Ya está en tu carrito", "Already in your cart", "Já está no seu carrinho")
      : compact
        ? pick(locale, "Agregar", "Add", "Adicionar")
        : pick(locale, "Agregar al carrito", "Add to cart", "Adicionar ao carrinho");

  return (
    <div className={className}>
      <div className={compact ? "flex flex-col gap-2" : "flex flex-wrap items-center gap-3"}>
        <button
          type="button"
          onClick={add}
          disabled={inCart}
          aria-label={compact ? label + " " + product.name : undefined}
          className={
            compact
              ? "inline-flex min-h-12 w-full items-center justify-center gap-2 bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-contrast disabled:cursor-default disabled:border disabled:border-border disabled:bg-transparent disabled:text-foreground"
              : secondary
                ? "inline-flex min-h-12 items-center justify-center gap-2.5 border border-border px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-accent disabled:cursor-default disabled:text-muted"
                : "inline-flex items-center justify-center gap-2.5 bg-accent px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast disabled:cursor-default disabled:border disabled:border-border disabled:bg-transparent disabled:text-muted"
          }
        >
          {inCart ? null : <CartIcon className="h-4 w-4" />}
          {label}
        </button>
        {inCart ? (
          <Link
            href="/carrito"
            className={
              compact
                ? "inline-flex min-h-10 w-full items-center justify-center gap-2 border border-border px-3 text-sm font-medium text-foreground transition-colors hover:border-accent hover:text-accent-contrast"
                : "group inline-flex items-center gap-2 border border-border px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-accent hover:text-accent-contrast"
            }
          >
            {pick(locale, "Ver carrito", "View cart", "Ver carrinho")}
            <ArrowIcon className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
      <p aria-live="polite" className="sr-only">
        {confirming
          ? product.name + pick(locale, " fue agregado al carrito.", " was added to the cart.", " foi adicionado ao carrinho.")
          : ""}
      </p>
    </div>
  );
}
