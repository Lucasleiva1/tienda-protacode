/**
 * Clave estable de una licencia: una por pedido y producto.
 *
 * Es la que viaja al sistema de licencias (como `idempotencyKey` o `purchaseId`).
 * No debe cambiar nunca: repetirla es lo que garantiza recibir la MISMA licencia.
 */
export function licenseIdempotencyKey(orderId: string, productId: string): string {
  return `license:${orderId}:${productId}`;
}
