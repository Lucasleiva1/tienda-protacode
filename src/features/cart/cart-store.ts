import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Estado del carrito.
 *
 * REGLA CENTRAL: acá solo viven identificadores. El nombre, el precio, la imagen y
 * la plataforma NO se guardan nunca; se vuelven a leer de la fuente de productos en
 * cada render. Así, si mañana cambia un precio o se despublica un programa, el
 * carrito usa el dato de hoy y no una copia vieja guardada en el navegador.
 *
 * AVISO PARA EL CHECKOUT (Parte 5): nunca confiar en totales ni precios que venga
 * del cliente para crear un pedido. El servidor tiene que recalcular el precio
 * leyendo los productos por su identificador. Lo que hay acá abajo sirve para
 * mostrar, no para cobrar.
 */

/** Clave de `localStorage`. Lleva versión para poder descartar formatos viejos. */
export const CART_STORAGE_KEY = "prota-code-cart-v1";

/** Tope de seguridad: evita que un storage manipulado infle la lista. */
const MAX_ITEMS = 50;

/**
 * Una línea del carrito.
 *
 * Hoy es solo el slug. En V1 un programa es una licencia y no hay cantidades; el día
 * que las haya, se agrega el campo acá sin tocar el resto de la arquitectura.
 *
 * Se guarda el `slug` y no el `id` interno porque el slug ya es la identidad pública
 * del producto (la URL) y porque `getProductBySlug()` devuelve solo publicados: un
 * programa despublicado deja de resolverse solo, sin lógica extra.
 */
export interface CartLine {
  readonly slug: string;
}

interface CartState {
  readonly items: readonly CartLine[];
  /** `true` recién cuando se leyó `localStorage`. Ver `use-cart-hydration.ts`. */
  readonly hydrated: boolean;
  addItem: (slug: string) => void;
  removeItem: (slug: string) => void;
  clear: () => void;
  setHydrated: (valor: boolean) => void;
}

/**
 * Limpia lo que venga de `localStorage`.
 *
 * Lo que hay ahí lo puede editar cualquiera desde la consola del navegador, así que
 * se trata como texto desconocido: si no tiene la forma esperada, se descarta y el
 * carrito arranca vacío en vez de romper la página.
 */
function sanearItems(guardado: unknown): CartLine[] {
  if (typeof guardado !== "object" || guardado === null) return [];

  const posible = (guardado as { items?: unknown }).items;
  if (!Array.isArray(posible)) return [];

  const vistos = new Set<string>();
  const limpios: CartLine[] = [];

  for (const linea of posible) {
    if (typeof linea !== "object" || linea === null) continue;

    const slug = (linea as { slug?: unknown }).slug;
    if (typeof slug !== "string") continue;

    const normalizado = slug.trim();
    if (normalizado === "" || vistos.has(normalizado)) continue;

    vistos.add(normalizado);
    limpios.push({ slug: normalizado });
    if (limpios.length >= MAX_ITEMS) break;
  }

  return limpios;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      hydrated: false,

      /** Sin duplicados: si el programa ya está, no hace nada. */
      addItem: (slug) => {
        if (get().items.some((linea) => linea.slug === slug)) return;
        if (get().items.length >= MAX_ITEMS) return;
        set((estado) => ({ items: [...estado.items, { slug }] }));
      },

      removeItem: (slug) =>
        set((estado) => ({
          items: estado.items.filter((linea) => linea.slug !== slug),
        })),

      clear: () => set({ items: [] }),

      setHydrated: (valor) => set({ hydrated: valor }),
    }),
    {
      name: CART_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),

      /*
        No se lee `localStorage` durante el render. El servidor y el primer render del
        navegador dibujan lo mismo (carrito vacío) y la lectura ocurre después, ya
        montado. Es lo que evita el error de hidratación sin tapar nada.
      */
      skipHydration: true,

      /** Solo se guardan los identificadores. `hydrated` es de esta sesión. */
      partialize: (estado) => ({ items: estado.items }),

      merge: (guardado, actual) => ({ ...actual, items: sanearItems(guardado) }),
    },
  ),
);

/* ------------------------------ selectores ------------------------------ */
/* Se derivan fuera del estado a propósito: en el store solo vive el dato crudo. */

export function useCartSlugs(): readonly CartLine[] {
  return useCartStore((estado) => estado.items);
}

export function useCartCount(): number {
  return useCartStore((estado) => estado.items.length);
}

export function useIsInCart(slug: string): boolean {
  return useCartStore((estado) =>
    estado.items.some((linea) => linea.slug === slug),
  );
}

export function useCartHydrated(): boolean {
  return useCartStore((estado) => estado.hydrated);
}
