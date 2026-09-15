import "server-only";
import { isNetlifyRuntime, STORES } from "@/lib/storage/store";

export interface StoredDownloadBody {
  readonly body: ReadableStream<Uint8Array> | ArrayBuffer;
}

export interface PrivateDownloadStorage {
  readonly engine: string;
  exists(key: string): Promise<boolean>;
  read(key: string): Promise<StoredDownloadBody | null>;
}

function safeKey(key: string): boolean {
  return (
    key.length >= 3 &&
    key.length <= 600 &&
    !key.startsWith("/") &&
    !key.includes("..") &&
    /^[A-Za-z0-9._/-]+$/.test(key)
  );
}

function createNetlifyDownloadStorage(): PrivateDownloadStorage {
  return {
    engine: "Netlify Blobs (privado)",

    async exists(key) {
      if (!safeKey(key)) return false;
      const { getStore } = await import("@netlify/blobs");
      const store = getStore({ name: STORES.downloads, consistency: "strong" });
      return (await store.getMetadata(key)) !== null;
    },

    async read(key) {
      if (!safeKey(key)) return null;
      const { getStore } = await import("@netlify/blobs");
      const store = getStore({ name: STORES.downloads, consistency: "strong" });
      const result = await store.get(key, { type: "stream" });
      return result === null ? null : { body: result };
    },
  };
}

function createLocalDownloadStorage(): PrivateDownloadStorage {
  async function fileFor(key: string) {
    if (!safeKey(key)) return null;
    const path = await import("node:path");
    const directory = path.join(process.cwd(), ".data", STORES.downloads);
    return {
      directory,
      path: path.join(directory, `${encodeURIComponent(key)}.bin`),
    };
  }

  return {
    engine: "Archivos locales privados (.data/)",

    async exists(key) {
      const target = await fileFor(key);
      if (target === null) return false;
      const fs = await import("node:fs/promises");
      try {
        await fs.access(/* turbopackIgnore: true */ target.path);
        return true;
      } catch {
        return false;
      }
    },

    async read(key) {
      const target = await fileFor(key);
      if (target === null) return null;
      const fs = await import("node:fs/promises");
      try {
        const bytes = await fs.readFile(/* turbopackIgnore: true */ target.path);
        return {
          body: bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength,
          ) as ArrayBuffer,
        };
      } catch {
        return null;
      }
    },
  };
}

let storage: PrivateDownloadStorage | null = null;

export function getPrivateDownloadStorage(): PrivateDownloadStorage {
  if (storage === null) {
    storage = isNetlifyRuntime()
      ? createNetlifyDownloadStorage()
      : createLocalDownloadStorage();
  }
  return storage;
}

/** Importación confiable para desarrollo; nunca recibe archivos desde una request. */
export async function importLocalDownload(
  key: string,
  sourcePath: string,
): Promise<void> {
  if (isNetlifyRuntime() || !safeKey(key)) throw new Error("LOCAL_DOWNLOAD_IMPORT_INVALID");
  const path = await import("node:path");
  const fs = await import("node:fs/promises");
  const directory = path.join(process.cwd(), ".data", STORES.downloads);
  const destination = path.join(directory, `${encodeURIComponent(key)}.bin`);
  await fs.mkdir(/* turbopackIgnore: true */ directory, { recursive: true });
  await fs.copyFile(/* turbopackIgnore: true */ sourcePath, destination);
}

export const NETLIFY_STREAMED_DOWNLOAD_LIMIT_BYTES = 20 * 1024 * 1024;
