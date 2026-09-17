import type { Order } from "@/types/order";

/**
 * Referencia que ven el comprador y el Admin.
 *
 * Los pedidos nuevos tienen su número PC-XXXX. Los anteriores a ese sistema siguen
 * mostrando los primeros ocho caracteres de su identificador, como siempre.
 */
export function orderDisplayReference(order: Pick<Order, "id" | "reference">): string {
  return order.reference ?? order.id.slice(0, 8).toUpperCase();
}

/** Ruta del Admin: con referencia si existe, así el enlace es legible. */
export function adminOrderPath(order: Pick<Order, "id" | "reference">): string {
  return `/admin/pedidos/${encodeURIComponent(order.reference ?? order.id)}`;
}

/** Nombre corto para listados y notificaciones: "Programa" o "Programa y 2 más". */
export function orderProductSummary(order: Pick<Order, "items">): string {
  const [first, ...rest] = order.items;
  if (first === undefined) return "Pedido sin productos";
  return rest.length === 0 ? first.name : `${first.name} y ${rest.length} más`;
}
