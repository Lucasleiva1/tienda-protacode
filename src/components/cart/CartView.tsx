"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CartSummary } from "@/components/cart/CartSummary";
import { EmptyCart } from "@/components/cart/EmptyCart";
import { CloseIcon } from "@/components/ui/Icons";
import { resolveCart } from "@/features/cart/cart-resolve";
import {
  useCartHydrated,
  useCartSlugs,
  useCartStore,
} from "@/features/cart/cart-store";
import { platformsLabel, primaryPrice } from "@/features/products/format";
import { localizeProduct } from "@/i18n/product-copy";
import { pick, type Locale } from "@/i18n/shared";
import type { Currency, Product } from "@/types/product";

interface CartViewProps {
  /** Catálogo actual, resuelto en el servidor. El store solo guarda slugs. */
  readonly catalog: readonly Product[];
  readonly locale: Locale;
  readonly currency: Currency;
  readonly whatsappRequested: boolean;
  readonly whatsappEnabled: boolean;
}

export function CartView({
  catalog,
  locale,
  currency,
  whatsappRequested,
  whatsappEnabled,
}: CartViewProps) {
  const hidratado = useCartHydrated();
  const lineas = useCartSlugs();
  const removeItem = useCartStore((estado) => estado.removeItem);
  const clear = useCartStore((estado) => estado.clear);
  const [aviso, setAviso] = useState("");

  const resolucion = useMemo(
    () => resolveCart(lineas.map((l) => l.slug), catalog, currency),
    [lineas, catalog, currency],
  );

  /*
    Limpieza de entradas muertas: un programa despublicado, renombrado, o un storage
    editado a mano. Se descartan en silencio en vez de mostrar "producto no
    disponible", que solo le daría trabajo al usuario por algo que no hizo él.
  */
  const clave = resolucion.missing.join("|");
  useEffect(() => {
    if (!hidratado || clave === "") return;
    for (const slug of clave.split("|")) removeItem(slug);
  }, [hidratado, clave, removeItem]);

  if (!hidratado) {
    return (
      <div
        aria-busy="true"
        className="h-64 border border-border bg-surface"
      >
        <span className="sr-only">{pick(locale, "Cargando tu carrito…", "Loading your cart…", "Carregando seu carrinho…")}</span>
      </div>
    );
  }

  const productos = resolucion.products;

  if (productos.length === 0) {
    return <EmptyCart locale={locale} />;
  }

  function quitar(producto: Product) {
    removeItem(producto.slug);
    setAviso(pick(locale, `${localizeProduct(producto, locale).name} fue eliminado del carrito.`, `${localizeProduct(producto, locale).name} was removed from your cart.`, `${localizeProduct(producto, locale).name} foi removido do carrinho.`));
  }

  function vaciar() {
    clear();
    setAviso(pick(locale, "Se vaciaron todos los programas del carrito.", "All programs were removed from your cart.", "Todos os programas foram removidos do carrinho."));
  }

  return (
    <div>
      <p aria-live="polite" className="sr-only">
        {aviso}
      </p>

      <p className="eyebrow mb-8">
        {productos.length === 1 ? pick(locale, "1 programa", "1 program", "1 programa") : `${productos.length} ${pick(locale, "programas", "programs", "programas")}`}
      </p>

      <div className="grid gap-10 lg:grid-cols-[1.9fr_1fr] lg:items-start lg:gap-14">
        <div>
          <ul className="border-t border-border">
            {productos.map((producto) => (
              <li
                key={producto.slug}
                className="flex flex-col gap-5 border-b border-border py-6 sm:flex-row sm:items-start sm:gap-6"
              >
                {producto.heroImage !== null ? (
                  <Image
                    src={producto.heroImage.src}
                    alt={producto.heroImage.alt}
                    width={200}
                    height={125}
                    sizes="120px"
                    loading="lazy"
                    className="h-20 w-32 shrink-0 border border-border object-cover"
                  />
                ) : null}

                <div className="min-w-0 flex-1">
                  <h2 className="display text-2xl">
                    <Link
                      href={`/programas/${producto.slug}`}
                      className="transition-colors hover:text-accent-contrast"
                    >
                      {localizeProduct(producto, locale).name}
                    </Link>
                  </h2>

                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {localizeProduct(producto, locale).shortDescription}
                  </p>

                  <p className="eyebrow mt-3">
                    {platformsLabel(producto.platforms)}
                    <span className="px-2 text-border">·</span>
                    {pick(locale, "versión", "version", "versão")} {producto.version}
                    <span className="px-2 text-border">·</span>
                    {pick(locale, "1 licencia", "1 license", "1 licença")}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-6 sm:flex-col sm:items-end sm:justify-start sm:gap-3">
                  <div className="sm:text-right">
                    <p className="text-xl font-semibold tracking-tight">
                      {primaryPrice(producto, locale)}
                    </p>
                    <p className="eyebrow mt-1 text-accent-contrast">{pick(locale, "Pago único", "One-time payment", "Pagamento único")}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => quitar(producto)}
                    aria-label={`Eliminar ${localizeProduct(producto, locale).name} del carrito`}
                    className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted transition-colors hover:border-danger/60 hover:text-foreground"
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                    {pick(locale, "Eliminar", "Remove", "Remover")}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {productos.length > 1 ? (
            <button
              type="button"
              onClick={vaciar}
              className="mt-6 text-sm text-muted underline decoration-border underline-offset-4 transition-colors hover:text-foreground hover:decoration-danger"
            >
              {pick(locale, "Vaciar carrito", "Empty cart", "Esvaziar carrinho")}
            </button>
          ) : null}
        </div>

        <CartSummary
          count={productos.length}
          locale={locale}
          subtotal={resolucion.subtotal}
          whatsappRequested={whatsappRequested}
          whatsappEnabled={whatsappEnabled}
        />
      </div>
    </div>
  );
}
