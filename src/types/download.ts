/** Metadatos privados de un instalador almacenado fuera de `/public`. */

export const DOWNLOAD_EXTENSIONS = ["exe", "msi", "zip", "dmg", "apk"] as const;

export type DownloadExtension = (typeof DOWNLOAD_EXTENSIONS)[number];

export interface DownloadFileReference {
  /** Clave interna en `prota-code-downloads`. Nunca se muestra al comprador. */
  readonly storageKey: string;
  /** Nombre visible y versionado que recibirá el comprador. */
  readonly fileName: string;
  readonly contentType: string;
  readonly size: number;
  /** SHA-256 hexadecimal del archivo. */
  readonly sha256: string;
  /** ISO 8601 en UTC. */
  readonly uploadedAt: string;
}

/** Asociación server-side entre un producto/versión y su binario privado. */
export interface ProductDownload {
  readonly productId: string;
  readonly version: string;
  readonly file: DownloadFileReference;
  readonly updatedAt: string;
}
