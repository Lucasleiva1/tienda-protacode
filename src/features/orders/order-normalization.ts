import type { Order } from "@/types/order";

/**
 * Completa pedidos guardados con esquemas anteriores sin inventar licencias,
 * descargas ni pagos. Se aplica al leer: los datos persistidos no se reescriben
 * hasta la próxima modificación real del pedido.
 */
export function normalizeOrder(order: Order): Order {
  const legacy = order as Order & {
    readonly reference?: Order["reference"];
    readonly fulfillment?: Partial<Order["fulfillment"]>;
    readonly purchaseAccess?: Order["purchaseAccess"];
    readonly manualPayment?: Order["manualPayment"];
    readonly notifications?: Partial<Order["notifications"]>;
  };

  return {
    ...order,
    reference: legacy.reference ?? null,
    customer: {
      ...order.customer,
      whatsapp: order.customer.whatsapp ?? null,
    },
    items: order.items.map((item) => {
      const previous = item as typeof item & Partial<typeof item>;
      return {
        ...item,
        platforms: previous.platforms ?? [],
        downloadType: previous.downloadType ?? "installer",
        // Antes de este campo, todo pedido se vendía con licencia.
        licenseRequired: previous.licenseRequired ?? true,
        licenseStatus: previous.licenseStatus ?? "not_requested",
        licenseKey: previous.licenseKey ?? null,
        licenseId: previous.licenseId ?? null,
        issuedAt: previous.issuedAt ?? null,
        licenseError: previous.licenseError ?? null,
        downloadFile: previous.downloadFile ?? null,
        downloadEnabledAt: previous.downloadEnabledAt ?? null,
      };
    }),
    manualPayment: legacy.manualPayment ?? null,
    fulfillment: {
      status: legacy.fulfillment?.status ?? "not_started",
      lastAttemptAt: legacy.fulfillment?.lastAttemptAt ?? null,
      completedAt: legacy.fulfillment?.completedAt ?? null,
      lastError: legacy.fulfillment?.lastError ?? null,
      licenseAssignedAt: legacy.fulfillment?.licenseAssignedAt ?? null,
    },
    purchaseAccess:
      legacy.purchaseAccess === undefined || legacy.purchaseAccess === null
        ? null
        : {
            ...legacy.purchaseAccess,
            extraTokenHashes: legacy.purchaseAccess.extraTokenHashes ?? [],
          },
    notifications: {
      paymentApprovedEmailAt: legacy.notifications?.paymentApprovedEmailAt ?? null,
      deliveryReadyEmailAt: legacy.notifications?.deliveryReadyEmailAt ?? null,
    },
  };
}
