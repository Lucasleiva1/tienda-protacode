"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CartIcon, CloseIcon } from "@/components/ui/Icons";
import { resolveCart } from "@/features/cart/cart-resolve";
import {
  useCartCount,
  useCartHydrated,
  useCartSlugs,
  useCartStore,
} from "@/features/cart/cart-store";
import { primaryPrice } from "@/features/products/format";
import { localizeProduct } from "@/i18n/product-copy";
import { numberLocale, pick, type Locale } from "@/i18n/shared";
import { formatMoney } from "@/lib/utils/money";
import type { Currency, Product } from "@/types/product";

interface CartLinkProps {
  readonly locale: Locale;
  /** Catálogo actual. El carrito solo guarda slugs; nombre y precio salen de acá. */
  readonly catalog: readonly Product[];
  readonly currency: Currency;
}

export function CartLink({ locale, catalog, currency }: CartLinkProps) {
  const hydrated = useCartHydrated();
  const count = useCartCount();
  const lineas = useCartSlugs();
  const removeItem = useCartStore((estado) => estado.removeItem);
  const visible = hydrated && count > 0;

  const [abierto, setAbierto] = useState(false);

  /*
    El panel no se cierra en el instante en que el mouse sale: entre el botón y el
    panel hay un pixel de aire y, sin esta demora, el panel parpadea y se escapa
    justo cuando lo vas a tocar.
  */
  const cierre = useRef<number | null>(null);

  function abrir() {
    if (cierre.current !== null) window.clearTimeout(cierre.current);
    setAbierto(true);
  }

  function cerrarConDemora() {
    if (cierre.current !== null) window.clearTimeout(cierre.current);
    cierre.current = window.setTimeout(() => setAbierto(false), 180);
  }

  useEffect(() => {
    return () => {
      if (cierre.current !== null) window.clearTimeout(cierre.current);
    };
  }, []);

  const resolucion = useMemo(
    () => resolveCart(lineas.map((l) => l.slug), catalog, currency),
    [lineas, catalog, currency],
  );

  const label = !hydrated
    ? pick(locale, "Carrito", "Cart", "Carrinho")
    : count === 0
      ? pick(locale, "Carrito vacío", "Empty cart", "Carrinho vazio")
      : count === 1
        ? pick(locale, "Carrito, 1 programa", "Cart, 1 program", "Carrinho, 1 programa")
        : pick(locale, "Carrito, " + count + " programas", "Cart, " + count + " programs", "Carrinho, " + count + " programas");

  const productos = resolucion.products;

  return (
    <div
      className="relative"
      onMouseEnter={abrir}
      onMouseLeave={cerrarConDemora}
      onFocus={abrir}
      onBlur={cerrarConDemora}
      onKeyDown={(evento) => {
        if (evento.key === "Escape") setAbierto(false);
      }}
    >
      <Link
        href="/carrito"
        aria-label={label}
        aria-expanded={visible ? abierto : undefined}
        className="relative flex h-10 w-10 items-center justify-center border border-border text-muted transition-colors hover:border-accent-contrast/60 hover:text-foreground"
      >
        <CartIcon className="h-5 w-5" />
        {visible ? (
          <span
            aria-hidden="true"
            className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center bg-accent px-1 text-[0.6875rem] font-semibold leading-none text-accent-foreground"
          >
            {count}
          </span>
        ) : null}
      </Link>

      {visible && abierto && productos.length > 0 ? (
        <div className="absolute right-0 top-full z-50 w-[min(22rem,calc(100vw-2rem))] pt-2">
          <div className="border border-border bg-surface shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
            <div aria-hidden="true" className="h-px bg-accent/70" />

            <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
              <p className="eyebrow text-accent-contrast">
                {pick(locale, "Tu carrito", "Your cart", "Seu carrinho")}
              </p>
              <p className="text-xs text-muted">
                {count === 1
                  ? pick(locale, "1 programa", "1 program", "1 programa")
                  : `${count} ${pick(locale, "programas", "programs", "programas")}`}
              </p>
            </div>

            <ul className="mt-3 max-h-[min(60vh,22rem)] overflow-y-auto border-t border-border">
              {productos.map((producto) => {
                const mostrado = localizeProduct(producto, locale);
                return (
                  <li
                    key={producto.slug}
                    className="flex items-start gap-3 border-b border-border px-4 py-3"
                  >
                    <Link
                      href={"/programas/" + producto.slug}
                      className="group flex min-w-0 flex-1 items-start gap-3"
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-border bg-background">
                        {producto.heroImage !== null ? (
                          <Image
                            src={producto.heroImage.src}
                            alt=""
                            width={48}
                            height={48}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <CartIcon className="h-4 w-4 text-muted" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-foreground transition-colors group-hover:text-accent-contrast">
                          {mostrado.name}
                        </span>
                        <span className="eyebrow mt-1 block">
                          {pick(locale, "versión", "version", "versão")} {producto.version}
                        </span>
                        <span className="mt-1 block text-sm font-semibold text-foreground">
                          {primaryPrice(producto, locale)}
                        </span>
                      </span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => removeItem(producto.slug)}
                      aria-label={
                        pick(locale, "Quitar ", "Remove ", "Remover ") + mostrado.name
                      }
                      title={pick(locale, "Quitar del carrito", "Remove from cart", "Remover do carrinho")}
                      className="shrink-0 border border-border p-1.5 text-muted transition-colors hover:border-danger/60 hover:text-foreground"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="flex items-baseline justify-between gap-3 px-4 py-3">
              <p className="eyebrow">{pick(locale, "Total", "Total", "Total")}</p>
              <p className="text-lg font-semibold text-foreground">
                {formatMoney(resolucion.subtotal, numberLocale(locale))}
              </p>
            </div>

            <div className="grid gap-2 px-4 pb-4">
              <Link
                href="/checkout"
                className="bg-accent px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-accent-foreground transition-colors hover:bg-accent-contrast"
              >
                {pick(locale, "Continuar con la compra", "Continue to checkout", "Continuar com a compra")}
              </Link>
              <Link
                href="/carrito"
                className="border border-border px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-accent"
              >
                {pick(locale, "Ver carrito", "View cart", "Ver carrinho")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
