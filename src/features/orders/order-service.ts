import "server-only";
import { getOrderRepository } from "@/features/orders/persistent-order-repository";
import { createPurchaseAccess } from "@/features/purchases/purchase-access";
import { getPurchaseAccessRepository } from "@/features/purchases/purchase-access-repository";
import { getProductBySlug } from "@/features/products/queries";
import type { Order, OrderCustomer, OrderItem } from "@/types/order";
import type { Currency, Product } from "@/types/product";

/**
 * Creación de pedidos.
 *
 * REGLA CENTRAL DE SEGURIDAD: del navegador solo se aceptan DOS cosas — los datos
 * del comprador y una lista de identificadores de programa. Todo lo demás —precio,
 * nombre, versión, appId, moneda, subtotal, total y estado— se vuelve a leer y a
 * calcular acá, en el servidor.
 *
 * El motivo es concreto: el carrito vive en `localStorage` y cualquiera puede
 * abrir la consola del navegador y escribir el precio que quiera. Si el servidor
 * confiara en ese número, se podría comprar un programa por un peso.
 */

export type CreateOrderProblem =
  | "empty_cart"
  | "product_unavailable"
  | "mixed_currencies"
  | "too_many_items"
  | "free_product";

export type CreateOrderResult =
  | { readonly ok: true; readonly order: Order; readonly purchaseToken: string }
  | { readonly ok: false; readonly problem: CreateOrderProblem; readonly message: string };

export interface CreateOrderInput {
  readonly customer: OrderCustomer;
  /** Identificadores de programa. Es lo ÚNICO que se acepta del navegador. */
  readonly slugs: readonly string[];
  /** Canal elegido por el servidor; nunca se acepta libremente desde el navegador. */
  readonly paymentProvider?: string | null;
}

const MAX_ITEMS = 20;

const MENSAJES: Record<CreateOrderProblem, string> = {
  empty_cart: "Tu carrito está vacío.",
  product_unavailable:
    "Uno de los programas de tu carrito ya no está disponible. Revisá el carrito antes de continuar.",
  mixed_currencies:
    "Los productos del carrito utilizan monedas diferentes. Dejá programas de una sola moneda para poder continuar.",
  too_many_items: "Hay demasiados programas en el carrito.",
  free_product:
    "Uno de los programas de tu carrito es gratuito y se descarga desde su ficha, sin pasar por el pago.",
};

function fallo(problem: CreateOrderProblem): CreateOrderResult {
  return { ok: false, problem, message: MENSAJES[problem] };
}

/** Congela los datos comerciales del programa tal como está hoy. */
function congelar(product: Product, currency: Currency): OrderItem {
  return {
    productId: product.id,
    slug: product.slug,
    appId: product.appId,
    name: product.name,
    version: product.version,
    platforms: product.platforms,
    downloadType: product.downloadType,
    unitPrice: product.price[currency],
    quantity: 1,
    licenseStatus: "not_requested",
    licenseKey: null,
    issuedAt: null,
    licenseError: null,
    downloadFile: null,
    downloadEnabledAt: null,
  };
}

export async function createPendingOrder(
  input: CreateOrderInput,
): Promise<CreateOrderResult> {
  // Se quitan repetidos: un programa es una licencia.
  const slugs = [...new Set(input.slugs.map((s) => s.trim()).filter((s) => s !== ""))];

  if (slugs.length === 0) return fallo("empty_cart");
  if (slugs.length > MAX_ITEMS) return fallo("too_many_items");

  /*
    Se releen los productos de la fuente confiable. `getProductBySlug()` devuelve
    solo publicados, así que un programa despublicado o inexistente frena el pedido
    en vez de venderse.
  */
  const productos: Product[] = [];
  for (const slug of slugs) {
    const producto = await getProductBySlug(slug);
    if (producto === undefined) return fallo("product_unavailable");
    // Un gratuito nunca genera pedido, ni siquiera si alguien fuerza el slug.
    if (producto.pricingType === "free") return fallo("free_product");
    productos.push(producto);
  }

  /*
    Una sola moneda por pedido. No se convierte ni se consultan tipos de cambio:
    si hay dos monedas distintas, se frena y se avisa.
  */
  const monedas = new Set(productos.map((producto) => producto.currency));
  if (monedas.size > 1) return fallo("mixed_currencies");

  const currency = productos[0]?.currency;
  if (currency === undefined) return fallo("empty_cart");

  const items = productos.map((producto) => congelar(producto, currency));

  // Precio calculado acá, con los datos de acá.
  const amount = items.reduce(
    (total, item) => total + item.unitPrice.amount * item.quantity,
    0,
  );

  const ahora = new Date().toISOString();

  /*
    Sin impuestos, sin envío y sin comisiones: son productos digitales y esos
    conceptos todavía no están definidos. Total = subtotal, sin renglones inventados.
  */
  const orderId = crypto.randomUUID();
  const purchaseAccess = createPurchaseAccess();
  const order: Order = {
    id: orderId,
    status: "pending",
    customer: input.customer,
    items,
    currency,
    subtotal: { amount, currency },
    total: { amount, currency },
    payment: {
      paymentId: null,
      status: "not_started",
      provider: input.paymentProvider ?? null,
      providerReference: null,
    },
    licenseStatus: "not_requested",
    fulfillment: {
      status: "not_started",
      lastAttemptAt: null,
      completedAt: null,
      lastError: null,
    },
    purchaseAccess: purchaseAccess.record,
    createdAt: ahora,
    updatedAt: ahora,
  };

  const accessRepository = getPurchaseAccessRepository();
  if (!(await accessRepository.reserve(purchaseAccess.record.tokenHash, orderId))) {
    throw new Error("PURCHASE_ACCESS_TOKEN_COLLISION");
  }

  try {
    await getOrderRepository().save(order);
  } catch (error) {
    await accessRepository.remove(purchaseAccess.record.tokenHash);
    throw error;
  }

  return { ok: true, order, purchaseToken: purchaseAccess.token };
}

export async function findOrder(id: string): Promise<Order | null> {
  if (!isOrderId(id)) return null;
  return getOrderRepository().findById(id);
}

export function isOrderId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
