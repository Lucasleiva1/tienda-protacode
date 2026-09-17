import "server-only";

import { orderDisplayReference } from "@/features/orders/order-display";
import { getConfiguredWhatsAppNumber } from "@/features/settings/sales-settings";
import { formatMoney } from "@/lib/utils/money";
import { normalizeWhatsAppNumber } from "@/lib/utils/whatsapp-number";
import type { Order } from "@/types/order";

export { normalizeWhatsAppNumber };

/**
 * WhatsApp es un medio alternativo: sirve para pagar o consultar coordinando por
 * chat. Abrir la conversación no confirma ningún pago ni habilita una descarga.
 */

/** Número receptor vigente: el del Admin, el de la variable de entorno o el inicial. */
export function getWhatsAppNumber(): Promise<string> {
  return getConfiguredWhatsAppNumber();
}

export function buildWhatsAppMessage(order: Order): string {
  const products = order.items.map((item) => {
    const quantity = item.quantity > 1 ? ` × ${item.quantity}` : "";
    return `• ${item.name} v${item.version}${quantity}`;
  });
  const method = order.manualPayment?.methodLabel ?? null;

  return [
    "Hola, quiero pagar o consultar mi compra en Prota Code.",
    "",
    `Pedido: ${orderDisplayReference(order)}`,
    `Nombre: ${order.customer.firstName} ${order.customer.lastName}`,
    "Productos:",
    ...products,
    `Total: ${formatMoney(order.total)}`,
    ...(method === null ? [] : [`Medio de pago: ${method}`]),
  ].join("\n");
}

export function buildWhatsAppCheckoutUrl(order: Order, number: string): string {
  const url = new URL(`https://wa.me/${number}`);
  url.searchParams.set("text", buildWhatsAppMessage(order));
  return url.toString();
}
