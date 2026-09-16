import type { Currency, Money, Product } from "@/types/product";

export interface CartResolution {
  /** Productos del carrito, en el orden en que se agregaron. */
  readonly products: readonly Product[];
  /** Slugs guardados que ya no corresponden a un programa publicado. */
  readonly missing: readonly string[];
  readonly subtotal: Money;
}

/**
 * Cruza los identificadores guardados contra el catálogo actual.
 *
 * Todo lo que se muestra del producto sale de acá, no de `localStorage`: precio,
 * nombre e imagen son siempre los de hoy.
 *
 * Un slug que ya no resuelve (el programa se despublicó, se renombró o alguien editó
 * el storage a mano) no rompe nada: sale por `missing` y la vista lo limpia.
 *
 * SOBRE LA MONEDA: el modelo obliga a que cada producto tenga precio en todas las
 * monedas (`PriceByCurrency` es un mapped type sobre `Currency`), así que no puede
 * existir un carrito con monedas mezcladas ni una suma inválida. Todo el carrito se
 * totaliza en una sola moneda, la del sitio.
 */
export function resolveCart(
  slugs: readonly string[],
  catalog: readonly Product[],
  currency: Currency,
): CartResolution {
  const porSlug = new Map(catalog.map((producto) => [producto.slug, producto]));

  const products: Product[] = [];
  const missing: string[] = [];

  for (const slug of slugs) {
    const producto = porSlug.get(slug);
    if (producto === undefined) {
      missing.push(slug);
      continue;
    }

    /*
      Un programa gratuito no se compra: se descarga desde su ficha. Si quedó uno
      guardado en el carrito (porque era pago y después pasó a gratuito), sale por
      `missing` y la vista lo limpia sola, igual que un programa despublicado.
    */
    if (producto.pricingType === "free") {
      missing.push(slug);
      continue;
    }
    products.push(producto);
  }

  const amount = products.reduce(
    (total, producto) => total + producto.price[currency].amount,
    0,
  );

  return { products, missing, subtotal: { amount, currency } };
}
