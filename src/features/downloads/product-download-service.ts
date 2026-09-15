import "server-only";
import {
  getProductDownloadRepository,
  type ProductDownloadRepository,
} from "@/features/downloads/product-download-repository";
import {
  getPrivateDownloadStorage,
  type PrivateDownloadStorage,
} from "@/lib/downloads/download-storage";
import { DOWNLOAD_EXTENSIONS, type ProductDownload } from "@/types/download";

const CONTENT_TYPES: Record<(typeof DOWNLOAD_EXTENSIONS)[number], string> = {
  exe: "application/vnd.microsoft.portable-executable",
  msi: "application/x-msi",
  zip: "application/zip",
  dmg: "application/x-apple-diskimage",
  apk: "application/vnd.android.package-archive",
};

const MAX_BLOB_BYTES = 5 * 1024 * 1024 * 1024;

export interface ProductDownloadInput {
  readonly storageKey: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly size: number;
  readonly sha256: string;
  readonly uploadedAt: string;
}

export type SaveProductDownloadResult =
  | { readonly ok: true; readonly download: ProductDownload }
  | { readonly ok: false; readonly message: string };

function extensionOf(fileName: string): keyof typeof CONTENT_TYPES | null {
  const extension = fileName.toLowerCase().split(".").pop();
  return DOWNLOAD_EXTENSIONS.includes(extension as keyof typeof CONTENT_TYPES)
    ? (extension as keyof typeof CONTENT_TYPES)
    : null;
}

export async function saveProductDownload(
  productId: string,
  version: string,
  input: ProductDownloadInput,
  dependencies: {
    readonly repository?: ProductDownloadRepository;
    readonly storage?: PrivateDownloadStorage;
  } = {},
): Promise<SaveProductDownloadResult> {
  const id = productId.trim();
  const productVersion = version.trim();
  const fileName = input.fileName.trim();
  const extension = extensionOf(fileName);
  const requiredPrefix = `products/${id}/${productVersion}/`;

  if (!/^[a-zA-Z0-9-]{8,}$/.test(id) || productVersion === "") {
    return { ok: false, message: "Producto o versión no válidos." };
  }
  if (extension === null) {
    return { ok: false, message: "Formato no admitido. Usá EXE, MSI, ZIP, DMG o APK." };
  }
  if (!fileName.toLowerCase().includes(`-v${productVersion.toLowerCase()}.`)) {
    return {
      ok: false,
      message: `El nombre debe incluir la versión visible: nombre-v${productVersion}.${extension}.`,
    };
  }
  if (
    !input.storageKey.startsWith(requiredPrefix) ||
    input.storageKey.includes("..") ||
    !/^[A-Za-z0-9._/-]+$/.test(input.storageKey)
  ) {
    return { ok: false, message: `La clave privada debe comenzar con ${requiredPrefix}` };
  }
  if (input.contentType !== CONTENT_TYPES[extension]) {
    return { ok: false, message: `Content-Type esperado: ${CONTENT_TYPES[extension]}.` };
  }
  if (!Number.isSafeInteger(input.size) || input.size <= 0 || input.size > MAX_BLOB_BYTES) {
    return { ok: false, message: "El tamaño declarado no es válido para Netlify Blobs." };
  }
  if (!/^[a-f0-9]{64}$/i.test(input.sha256)) {
    return { ok: false, message: "SHA-256 debe tener 64 caracteres hexadecimales." };
  }
  if (Number.isNaN(Date.parse(input.uploadedAt))) {
    return { ok: false, message: "La fecha de carga no es válida." };
  }

  const storage = dependencies.storage ?? getPrivateDownloadStorage();
  if (!(await storage.exists(input.storageKey))) {
    return { ok: false, message: "El blob privado indicado no existe." };
  }

  const download: ProductDownload = {
    productId: id,
    version: productVersion,
    file: {
      storageKey: input.storageKey,
      fileName,
      contentType: input.contentType,
      size: input.size,
      sha256: input.sha256.toLowerCase(),
      uploadedAt: new Date(input.uploadedAt).toISOString(),
    },
    updatedAt: new Date().toISOString(),
  };
  await (dependencies.repository ?? getProductDownloadRepository()).save(download);
  return { ok: true, download };
}

export async function removeProductDownload(
  productId: string,
  version: string,
): Promise<void> {
  // Se retira la asociación, no el Blob: pedidos anteriores pueden seguir usándolo.
  await getProductDownloadRepository().remove(productId, version);
}

export function contentTypeForFile(fileName: string): string | null {
  const extension = extensionOf(fileName);
  return extension === null ? null : CONTENT_TYPES[extension];
}
