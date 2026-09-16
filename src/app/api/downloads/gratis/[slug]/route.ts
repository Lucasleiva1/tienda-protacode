import { getProductDownloadRepository } from "@/features/downloads/product-download-repository";
import { getProductBySlug } from "@/features/products/queries";
import {
  getPrivateDownloadStorage,
  NETLIFY_STREAMED_DOWNLOAD_LIMIT_BYTES,
} from "@/lib/downloads/download-storage";
import { allowRequest } from "@/lib/security/rate-limit";
import { isNetlifyRuntime } from "@/lib/storage/store";

/**
 * Descarga de un programa GRATUITO.
 *
 * No hay pedido, ni pago, ni licencia, ni token: por eso la única llave es que el
 * producto esté publicado y marcado como gratuito. Se vuelve a leer del almacén en
 * cada pedido; el navegador no manda precio ni estado, solo el slug de la URL.
 *
 * Los programas pagos NO pasan por acá: siguen entrando por
 * /api/downloads/[orderId]/[productId], que exige compra aprobada.
 */

export const runtime = "nodejs";

function attachmentHeader(fileName: string): string {
  const ascii = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function noDisponible(mensaje: string, status: number): Response {
  return new Response(mensaje, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(
  _request: Request,
  context: RouteContext<"/api/downloads/gratis/[slug]">,
) {
  const { slug } = await context.params;

  if (!allowRequest("free-download", slug, 20, 60_000)) {
    return new Response("Demasiadas solicitudes", {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  const producto = await getProductBySlug(slug);
  if (producto === undefined || producto.pricingType !== "free") {
    return noDisponible("Descarga no encontrada.", 404);
  }

  const download = await getProductDownloadRepository().find(
    producto.id,
    producto.version,
  );
  if (download === null) {
    return noDisponible("La descarga todavía no está disponible.", 404);
  }

  if (isNetlifyRuntime() && download.file.size > NETLIFY_STREAMED_DOWNLOAD_LIMIT_BYTES) {
    return noDisponible(
      "Este archivo requiere un proveedor de entrega compatible con binarios grandes.",
      503,
    );
  }

  const stored = await getPrivateDownloadStorage().read(download.file.storageKey);
  if (stored === null) {
    return noDisponible("Archivo no disponible", 404);
  }

  return new Response(stored.body, {
    status: 200,
    headers: {
      "Content-Type": download.file.contentType,
      "Content-Length": String(download.file.size),
      "Content-Disposition": attachmentHeader(download.file.fileName),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Referrer-Policy": "no-referrer",
    },
  });
}
