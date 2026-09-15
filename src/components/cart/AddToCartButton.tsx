"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowIcon, CartIcon } from "@/components/ui/Icons";
import { useCartStore, useIsInCart } from "@/features/cart/cart-store";
import type { Product } from "@/types/product";

interface AddToCartButtonProps {
  readonly product: Product;
  readonly className?: string;
}

/** Cuánto dura el cartel de "agregado" antes de volver al estado normal. */
const MS_CONFIRMACION = 2200;

/**
 * Agregar al carrito.
 *
 * Es el único pedazo interactivo de la ficha: la página sigue siendo de servidor.
 *
 * Tres estados, sin librería de avisos:
 *   1. AGREGAR AL CARRITO
 *   2. AGREGADO            (dos segundos, justo después de tocarlo)
 *   3. YA ESTÁ EN TU CARRITO + enlace VER CARRITO
 *
 * Un programa es una licencia: si ya está, el botón no lo vuelve a sumar ni crea una
 * segunda línea. No lleva al carrito solo; el usuario decide cuándo ir.
 */
export function AddToCartButton({ product, className = "" }: AddToCartButtonProps) {
  const enCarrito = useIsInCart(product.slug);
  const addItem = useCartStore((estado) => estado.addItem);
  const [confirmando, setConfirmando] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current !== null) clearTimeout(temporizador.current);
    },
    [],
  );

  function agregar() {
    addItem(product.slug);
    setConfirmando(true);
    if (temporizador.current !== null) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setConfirmando(false), MS_CONFIRMACION);
  }

  const yaEstaba = enCarrito && !confirmando;

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={agregar}
          disabled={enCarrito}
          className="inline-flex items-center justify-center gap-2.5 bg-accent px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast disabled:cursor-default disabled:border disabled:border-border disabled:bg-transparent disabled:text-muted"
        >
          {enCarrito ? null : <CartIcon className="h-4 w-4" />}
          {confirmando
            ? "Agregado"
            : yaEstaba
              ? "Ya está en tu carrito"
              : "Agregar al carrito"}
        </button>

        {enCarrito ? (
          <Link
            href="/carrito"
            className="group inline-flex items-center gap-2 border border-border px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-accent hover:text-accent-contrast"
          >
            Ver carrito
            <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        ) : null}
      </div>

      {/* Lo mismo que se ve, anunciado para lectores de pantalla. */}
      <p aria-live="polite" className="sr-only">
        {confirmando ? `${product.name} fue agregado al carrito.` : ""}
      </p>
    </div>
  );
}
