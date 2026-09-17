import "server-only";
import { isOrderId } from "@/features/orders/order-id";
import {
  getOrderReferenceRepository,
  normalizeOrderReference,
  type OrderReferenceRepository,
} from "@/features/orders/order-reference-repository";
import type { OrderRepository } from "@/features/orders/order-repository";
import { getOrderRepository } from "@/features/orders/persistent-order-repository";
import { initialManualPayment } from "@/features/payments/manual-payment-state";
import { getProductBySlug } from "@/features/products/queries";
import { createPurchaseAccess } from "@/features/purchases/purchase-access";
import {
  getPurchaseAccessRepository,
  type PurchaseAccessRepository,
} from "@/features/purchases/purchase-access-repository";
import type { OrderManualPayment } from "@/types/manual-payment";
import type {
  Order,
  OrderCustomer,
  OrderItem,
  OrderPayment,
  OrderStatus,
  PurchaseAccess,
} from "@/types/order";
import type { Currency, Product } from "@/types/product";

export { isOrderId };

/**
 * Creación de pedidos.
 *
 * REGLA CENTRAL DE SEGURIDAD: del navegador solo se aceptan DOS cosas — los datos
 * del comprador y una lista de identificadores de programa. Todo lo demás —precio,
 * nombre, versión, appId, moneda, subtotal, total y estado— se vuelve a leer y a
 * calcular acá, en el servidor. La cuenta del comprador, si existe, la resuelve la
 * sesión: nunca un identificador enviado por el navegador.
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
  | "free_product"
  | "invalid_total";

export type CreateOrderResult =
  | { readonly ok: true; readonly order: Order; readonly purchaseToken: string }
  | { readonly ok: false; readonly problem: CreateOrderProblem; readonly message: string };

export interface CreateOrderInput {
  readonly customer: OrderCustomer;
  /** Identificadores de programa. Es lo ÚNICO del carrito que se acepta del navegador. */
  readonly slugs: readonly string[];
  /** "manual": Prex, Ualá, transferencia/QR o WhatsApp. "gateway": pasarela automática. */
  readonly paymentMode: "manual" | "gateway";
}

export interface OrderCreationDependencies {
  readonly findProduct: (slug: string) => Promise<Product | undefined>;
  readonly orders: OrderRepository;
  readonly access: PurchaseAccessRepository;
  readonly references: OrderReferenceRepository;
  readonly clock?: () => Date;
}

function defaultDependencies(): OrderCreationDependencies {
  return {
    findProduct: getProductBySlug,
    orders: getOrderRepository(),
    access: getPurchaseAccessRepository(),
    references: getOrderReferenceRepository(),
  };
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
  invalid_total: "Este programa todavía no tiene un precio válido. Probá más tarde.",
};

function fallo(problem: CreateOrderProblem): CreateOrderResult {
  return { ok: false, problem, message: MENSAJES[problem] };
}

/**
 * Congela los datos comerciales del programa tal como está hoy.
 *
 * `free` fuerza el importe a cero: un gratuito conserva su precio guardado por si
 * vuelve a venderse, pero ese número nunca se cobra.
 */
export function freezeOrderItem(
  product: Product,
  currency: Currency,
  options: { readonly free?: boolean } = {},
): OrderItem {
  return {
    productId: product.id,
    slug: product.slug,
    appId: product.appId,
    name: product.name,
    version: product.version,
    platforms: product.platforms,
    downloadType: product.downloadType,
    unitPrice: options.free === true ? { amount: 0, currency } : product.price[currency],
    quantity: 1,
    licenseRequired: product.licenseRequired,
    licenseStatus: "not_requested",
    licenseKey: null,
    licenseId: null,
    issuedAt: null,
    licenseError: null,
    downloadFile: null,
    downloadEnabledAt: null,
  };
}

/** Arma un pedido completo. Sin impuestos, envío ni comisiones: total = subtotal. */
export function buildOrder(input: {
  readonly id: string;
  readonly reference: string;
  readonly status: OrderStatus;
  readonly customer: OrderCustomer;
  readonly items: readonly OrderItem[];
  readonly currency: Currency;
  readonly payment: OrderPayment;
  readonly manualPayment: OrderManualPayment | null;
  readonly purchaseAccess: PurchaseAccess;
  readonly now: string;
}): Order {
  const amount = input.items.reduce(
    (total, item) => total + item.unitPrice.amount * item.quantity,
    0,
  );
  return {
    id: input.id,
    reference: input.reference,
    status: input.status,
    customer: input.customer,
    items: input.items,
    currency: input.currency,
    subtotal: { amount, currency: input.currency },
    total: { amount, currency: input.currency },
    payment: input.payment,
    manualPayment: input.manualPayment,
    licenseStatus: "not_requested",
    fulfillment: {
      status: "not_started",
      lastAttemptAt: null,
      completedAt: null,
      lastError: null,
      licenseAssignedAt: null,
    },
    purchaseAccess: input.purchaseAccess,
    notifications: { paymentApprovedEmailAt: null, deliveryReadyEmailAt: null },
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/**
 * Guarda un pedido nuevo con su referencia y su token de acceso reservados.
 * Si algo falla, libera las reservas para no dejar índices huérfanos.
 */
export async function persistNewOrder(
  build: (reference: string, access: ReturnType<typeof createPurchaseAccess>) => Order,
  orderId: string,
  dependencies: Pick<OrderCreationDependencies, "orders" | "access" | "references">,
): Promise<{ readonly order: Order; readonly purchaseToken: string }> {
  const reference = await dependencies.references.allocate(orderId);
  const purchaseAccess = createPurchaseAccess();

  if (!(await dependencies.access.reserve(purchaseAccess.record.tokenHash, orderId))) {
    await dependencies.references.release(reference, orderId);
    throw new Error("PURCHASE_ACCESS_TOKEN_COLLISION");
  }

  const order = build(reference, purchaseAccess);
  try {
    await dependencies.orders.save(order);
  } catch (error) {
    await dependencies.access.remove(purchaseAccess.record.tokenHash);
    await dependencies.references.release(reference, orderId);
    throw error;
  }
  return { order, purchaseToken: purchaseAccess.token };
}

export async function createPendingOrder(
  input: CreateOrderInput,
  dependencies: OrderCreationDependencies = defaultDependencies(),
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
    const producto = await dependencies.findProduct(slug);
    if (producto === undefined) return fallo("product_unavailable");
    // Un gratuito nunca genera pedido de pago, ni siquiera si alguien fuerza el slug.
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

  const items = productos.map((producto) => freezeOrderItem(producto, currency));
  const amount = items.reduce((total, item) => total + item.unitPrice.amount, 0);
  if (!Number.isSafeInteger(amount) || amount <= 0) return fallo("invalid_total");

  const now = (dependencies.clock?.() ?? new Date()).toISOString();
  const orderId = crypto.randomUUID();
  const manual = input.paymentMode === "manual";

  const saved = await persistNewOrder(
    (reference, access) =>
      buildOrder({
        id: orderId,
        reference,
        status: "pending",
        customer: input.customer,
        items,
        currency,
        payment: {
          paymentId: null,
          status: "not_started",
          provider: manual ? "manual" : null,
          providerReference: null,
        },
        manualPayment: manual ? initialManualPayment() : null,
        purchaseAccess: access.record,
        now,
      }),
    orderId,
    dependencies,
  );

  return { ok: true, order: saved.order, purchaseToken: saved.purchaseToken };
}

/** Busca por UUID interno o por referencia legible (PC-1051). */
export async function findOrder(value: string): Promise<Order | null> {
  const candidate = value.trim();
  if (isOrderId(candidate)) return getOrderRepository().findById(candidate);

  const reference = normalizeOrderReference(candidate);
  if (reference === null) return null;
  const orderId = await getOrderReferenceRepository().findOrderId(reference);
  return orderId === null ? null : getOrderRepository().findById(orderId);
}
