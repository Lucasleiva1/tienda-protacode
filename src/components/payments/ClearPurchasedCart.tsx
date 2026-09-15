"use client";

import { useEffect } from "react";
import { useCartHydrated, useCartStore } from "@/features/cart/cart-store";

interface ClearPurchasedCartProps {
  readonly slugs: readonly string[];
}

/** Quita solo lo realmente comprado, y solo después de una confirmación server-side. */
export function ClearPurchasedCart({ slugs }: ClearPurchasedCartProps) {
  const hydrated = useCartHydrated();
  const removeItem = useCartStore((state) => state.removeItem);
  const key = slugs.join("|");

  useEffect(() => {
    if (!hydrated || key === "") return;
    for (const slug of key.split("|")) removeItem(slug);
  }, [hydrated, key, removeItem]);

  return null;
}
