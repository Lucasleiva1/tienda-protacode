import type { Order } from "@/types/order";

/**
 * Completa pedidos creados antes de la Parte 8 sin inventar licencias ni descargas.
 * Permite que el Admin siga abriendo datos persistidos con el esquema anterior.
 */
export function normalizeOrder(order: Order): Order {
  const legacy = order as Order & {
    readonly fulfillment?: Order["fulfillment"];
    readonly purchaseAccess?: Order["purchaseAccess"];
  };

  return {
    ...order,
    items: order.items.map((item) => {
      const previous = item as typeof item & Partial<typeof item>;
      return {
        ...item,
        platforms: previous.platforms ?? [],
        downloadType: previous.downloadType ?? "installer",
        licenseStatus: previous.licenseStatus ?? "not_requested",
        licenseKey: previous.licenseKey ?? null,
        issuedAt: previous.issuedAt ?? null,
        licenseError: previous.licenseError ?? null,
        downloadFile: previous.downloadFile ?? null,
        downloadEnabledAt: previous.downloadEnabledAt ?? null,
      };
    }),
    fulfillment: legacy.fulfillment ?? {
      status: "not_started",
      lastAttemptAt: null,
      completedAt: null,
      lastError: null,
    },
    purchaseAccess: legacy.purchaseAccess ?? null,
  };
}
