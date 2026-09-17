import { isAdmin } from "@/features/admin/guard";
import { orderDisplayReference } from "@/features/orders/order-display";
import { findOrder } from "@/features/orders/order-service";
import { getPaymentProofStorage } from "@/features/payments/payment-proof-storage";

export const runtime = "nodejs";

/**
 * Comprobante de pago, solo para el Admin.
 *
 * Las imágenes se muestran en el navegador; los PDF se descargan para no abrir un
 * documento subido por un tercero dentro del sitio. Nunca se cachea.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/admin/comprobantes/[orderId]">,
) {
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  if (!(await isAdmin())) return new Response("No autorizado", { status: 401, headers });

  const { orderId } = await context.params;
  const order = await findOrder(orderId);
  const proof = order?.manualPayment?.proof ?? null;
  if (order === null || proof === null) {
    return new Response("Comprobante no encontrado", { status: 404, headers });
  }

  const stored = await getPaymentProofStorage().read(proof);
  if (stored === null) return new Response("Comprobante no encontrado", { status: 404, headers });

  const isPdf = stored.contentType === "application/pdf";
  const name = `comprobante-${orderDisplayReference(order)}.${isPdf ? "pdf" : stored.contentType.split("/")[1] ?? "bin"}`;

  return new Response(new Uint8Array(stored.bytes), {
    status: 200,
    headers: {
      ...headers,
      "Content-Type": stored.contentType,
      "Content-Length": String(stored.bytes.byteLength),
      "Content-Disposition": `${isPdf ? "attachment" : "inline"}; filename="${name.replace(/[^A-Za-z0-9._-]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
    },
  });
}
