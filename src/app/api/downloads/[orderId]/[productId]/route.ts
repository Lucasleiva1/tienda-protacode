import { authorizeDownload } from "@/features/downloads/download-authorization";
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

  if (!allowRequest("purchase-download", token, 12, 60_000)) {
    return new Response("Demasiadas solicitudes", {
      status: 429,
      headers: { "Retry-After": "60", "Cache-Control": "no-store" },
    });
  }

  const { orderId, productId } = await context.params;
  const authorization = await authorizeDownload({
    orderId,
    productId,
    purchaseToken: token,
  });
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
