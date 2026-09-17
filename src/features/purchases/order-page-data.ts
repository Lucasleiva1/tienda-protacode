import "server-only";

import { buildWhatsAppCheckoutUrl, getWhatsAppNumber } from "@/features/checkout/whatsapp";
import {
  getActivePaymentMethods,
  type PublicPaymentMethod,
} from "@/features/settings/payment-method-settings";
import type { Order } from "@/types/order";

/**
 * Datos públicos que necesita la página de un pedido: medios activos y el enlace
 * de WhatsApp (solo si ese medio está activo en el Admin).
 */
export async function getOrderPaymentContext(order: Order): Promise<{
  readonly methods: readonly PublicPaymentMethod[];
  readonly whatsappUrl: string | null;
}> {
  const methods = await getActivePaymentMethods();
  const whatsappActive = methods.some((method) => method.kind === "whatsapp");
  const whatsappUrl = whatsappActive
    ? buildWhatsAppCheckoutUrl(order, await getWhatsAppNumber())
    : null;
  return { methods, whatsappUrl };
}
