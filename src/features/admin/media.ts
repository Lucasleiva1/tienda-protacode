import "server-only";
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

const PERMITIDOS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Comprueba el tipo real mirando los primeros bytes del archivo.
 *
 * No se confía en el nombre ni en el tipo que declara el navegador: los dos los
 * elige quien sube el archivo. Un `.png` puede ser cualquier cosa adentro; estos
 * bytes iniciales, no.
 */
function tipoReal(bytes: Uint8Array): string | null {
  const b = bytes;

  // JPEG: FF D8 FF
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length > 8 && PNG.every((valor, i) => b[i] === valor)) {
    return "image/png";
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    b.length > 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

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
export async function saveProductImage(
  productId: string,
  archivo: File,
): Promise<UploadResult> {
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
  const contentType = tipoReal(bytes);

  if (contentType === null) {
    return {
      ok: false,
      message: "El archivo no es una imagen JPG, PNG o WEBP válida.",
    };
  }

  const extension = PERMITIDOS[contentType];
  if (extension === undefined) {
    return { ok: false, message: "Formato no admitido." };
  }

  const idLimpio = productId.replace(/[^a-zA-Z0-9-]/g, "");
  const key = `products/${idLimpio}/${crypto.randomUUID()}.${extension}`;

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
