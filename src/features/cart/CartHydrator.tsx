"use client";

import { useEffect } from "react";
import { useCartStore } from "@/features/cart/cart-store";

/**
 * Lee el carrito guardado, una sola vez, después de montar.
 *
 * Por qué existe en vez de dejar que zustand lo haga solo: si el store leyera
 * `localStorage` mientras se arma, el servidor dibujaría un carrito vacío y el
 * navegador uno con productos, y React se quejaría de que el HTML no coincide. Con
 * `skipHydration` los dos dibujan vacío, y recién acá se completa.
 *
 * Va en el layout raíz para que corra una vez por visita, en cualquier página.
 * No dibuja nada.
 */
export function CartHydrator() {
  useEffect(() => {
    let cancelado = false;

    void (async () => {
      try {
        await useCartStore.persist.rehydrate();
      } catch {
        // Un `localStorage` ilegible no puede tumbar la página: se sigue vacío.
      }
      if (!cancelado) {
        useCartStore.getState().setHydrated(true);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, []);

  return null;
}
