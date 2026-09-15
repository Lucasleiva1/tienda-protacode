import "server-only";

import { formatMoney } from "@/lib/utils/money";
import type { Order } from "@/types/order";
import { getConfiguredWhatsAppNumber } from "@/features/settings/sales-settings";

export interface WhatsAppConfiguration {
  readonly requested: boolean;
  readonly ready: boolean;
  readonly number: string | null;
  readonly message: string;
}

/**
 * El número se configura en formato internacional, pero se toleran espacios,
 * paréntesis, guiones y el signo + para que no sea fácil cargarlo mal en Netlify.
 */
export function normalizeWhatsAppNumber(value: string | undefined): string | null {
  if (value === undefined) return null;
  const digits = value.replace(/\D/g, "");
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

export async function getWhatsAppConfiguration(): Promise<WhatsAppConfiguration> {
  const channel = (process.env.SALES_CHANNEL ?? "whatsapp").trim().toLowerCase();
  const requested = channel === "whatsapp";

  if (!requested) {
    return {
      requested: false,
      ready: false,
      number: null,
      message: `El canal de venta activo es “${channel || "payment"}”.`,
    };
  }

  const number = await getConfiguredWhatsAppNumber();

  return {
    requested: true,
    ready: true,
    number,
    message: "Los pedidos se guardan antes de abrir la conversación de WhatsApp.",
  };
}

function orderReference(order: Order): string {
  return order.id.slice(0, 8).toUpperCase();
}

export function buildWhatsAppMessage(order: Order): string {
  const products = order.items.map((item) => {
    const quantity = item.quantity > 1 ? ` × ${item.quantity}` : "";
    return `• ${item.name} v${item.version}${quantity}`;
  });

  return [
    "Hola, quiero comprar en Prota Code.",
    "",
    `Pedido: ${orderReference(order)}`,
    `Nombre: ${order.customer.firstName} ${order.customer.lastName}`,
    "Productos:",
    ...products,
    `Total: ${formatMoney(order.total)}`,
    "",
    "Quisiera coordinar el pago y la entrega.",
  ].join("\n");
}

export function buildWhatsAppCheckoutUrl(order: Order, number: string): string {
  const url = new URL(`https://wa.me/${number}`);
  url.searchParams.set("text", buildWhatsAppMessage(order));
  return url.toString();
}
