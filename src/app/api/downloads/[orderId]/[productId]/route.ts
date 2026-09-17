import {
  authorizeDownload,
  authorizeOrderItemDownload,
  type DownloadAuthorizationResult,
} from "@/features/downloads/download-authorization";
import { resolveOrderAccess } from "@/features/purchases/order-access";
import {
  getPrivateDownloadStorage,
  NETLIFY_STREAMED_DOWNLOAD_LIMIT_BYTES,
} from "@/lib/downloads/download-storage";
import { isNetlifyRuntime } from "@/lib/storage/store";
import { allowRequest } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

function attachmentHeader(fileName: string): string {
  const ascii = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * Descarga privada de una compra.
 *
 * Dos llaves posibles, siempre por POST:
 *   - `purchaseToken`: el enlace privado del pedido;
 *   - sin token: la sesión de la cuenta dueña del pedido ("Mis compras").
 */
export async function POST(
  request: Request,
  context: RouteContext<"/api/downloads/[orderId]/[productId]">,
) {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!Number.isFinite(length) || length > 4096) {
    return new Response("Solicitud no válida", { status: 400 });
  }

  let token = "";
  try {
    const form = await request.formData();
    token = String(form.get("purchaseToken") ?? "");
  } catch {
    return new Response("Solicitud no válida", { status: 400 });
  }

  const { orderId, productId } = await context.params;
  if (!allowRequest("purchase-download", token === "" ? `account:${orderId}` : token, 12, 60_000)) {
    return new Response("Demasiadas solicitudes", {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  let authorization: DownloadAuthorizationResult;
  if (token !== "") {
    authorization = await authorizeDownload({ orderId, productId, purchaseToken: token });
  } else {
    const order = await resolveOrderAccess({ kind: "account", orderId });
    authorization =
      order === null || order.id !== orderId
        ? { ok: false, code: "NOT_FOUND", message: "Descarga no encontrada." }
        : authorizeOrderItemDownload(order, productId);
  }

  if (!authorization.ok) {
    return new Response(authorization.message, {
      status: authorization.code === "NOT_FOUND" ? 404 : 403,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (
    isNetlifyRuntime() &&
    authorization.file.size > NETLIFY_STREAMED_DOWNLOAD_LIMIT_BYTES
  ) {
    return new Response(
      "Este archivo requiere un proveedor de entrega compatible con binarios grandes.",
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const stored = await getPrivateDownloadStorage().read(authorization.file.storageKey);
  if (stored === null) {
    return new Response("Archivo no disponible", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response(stored.body, {
    status: 200,
    headers: {
      "Content-Type": authorization.file.contentType,
      "Content-Length": String(authorization.file.size),
      "Content-Disposition": attachmentHeader(authorization.file.fileName),
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Referrer-Policy": "no-referrer",
    },
  });
}
