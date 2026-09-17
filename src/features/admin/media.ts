import "server-only";
import { detectFileType, FILE_EXTENSIONS } from "@/lib/files/file-signature";
import { getKeyValueStore, STORES } from "@/lib/storage/store";

/**
 * Imágenes de los programas.
 *
 * Se guardan en su propio almacén (`prota-code-media`), separado de los productos y
 * de los pedidos.
 *
 * El contenido va en base64 dentro de un JSON. Es un 33% más grande que el binario
 * puro, pero permite que el mismo código funcione tanto con Netlify Blobs como con
 * los archivos locales de desarrollo, sin dos caminos distintos que mantener. Para
 * un puñado de capturas de pantalla, el costo no se nota.
 */

export interface StoredMedia {
  readonly contentType: string;
  readonly base64: string;
  readonly size: number;
  readonly uploadedAt: string;
}

const MAX_BYTES = 3 * 1024 * 1024;

export type UploadResult =
  | { readonly ok: true; readonly key: string; readonly url: string }
  | { readonly ok: false; readonly message: string };

/**
 * Guarda una imagen de producto.
 *
 * La clave se genera acá: `products/<productId>/<uuid>.<ext>`. Nunca se usa el
 * nombre original del archivo, que podría traer barras o `..` e intentar escribir
 * fuera de su lugar.
 */
export function saveProductImage(productId: string, archivo: File): Promise<UploadResult> {
  const idLimpio = productId.replace(/[^a-zA-Z0-9-]/g, "");
  return saveMediaImage(`products/${idLimpio}`, archivo);
}

/** QR público de un medio de pago. No contiene datos privados del comprador. */
export function savePaymentMethodQr(methodId: string, archivo: File): Promise<UploadResult> {
  const idLimpio = methodId.replace(/[^a-z]/g, "");
  return saveMediaImage(`payment-methods/${idLimpio}`, archivo);
}

async function saveMediaImage(carpeta: string, archivo: File): Promise<UploadResult> {
  if (archivo.size === 0) {
    return { ok: false, message: "El archivo está vacío." };
  }

  if (archivo.size > MAX_BYTES) {
    return {
      ok: false,
      message: `La imagen pesa demasiado. El máximo es ${MAX_BYTES / 1024 / 1024} MB.`,
    };
  }

  const bytes = new Uint8Array(await archivo.arrayBuffer());
  const contentType = detectFileType(bytes);

  // Las imágenes públicas nunca aceptan PDF.
  if (contentType === null || contentType === "application/pdf") {
    return {
      ok: false,
      message: "El archivo no es una imagen JPG, PNG o WEBP válida.",
    };
  }

  const key = `${carpeta}/${crypto.randomUUID()}.${FILE_EXTENSIONS[contentType]}`;

  const media: StoredMedia = {
    contentType,
    base64: Buffer.from(bytes).toString("base64"),
    size: bytes.byteLength,
    uploadedAt: new Date().toISOString(),
  };

  await getKeyValueStore(STORES.media).set(key, media);

  return { ok: true, key, url: `/api/media/${key}` };
}

export function readMedia(key: string): Promise<StoredMedia | null> {
  return getKeyValueStore(STORES.media).get<StoredMedia>(key);
}

export async function deleteMedia(key: string): Promise<void> {
  await getKeyValueStore(STORES.media).remove(key);
}
