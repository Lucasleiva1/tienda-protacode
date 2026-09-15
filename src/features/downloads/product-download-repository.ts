import "server-only";
import { getKeyValueStore, STORES } from "@/lib/storage/store";
import type { ProductDownload } from "@/types/download";

export interface ProductDownloadRepository {
  find(productId: string, version: string): Promise<ProductDownload | null>;
  save(download: ProductDownload): Promise<void>;
  remove(productId: string, version: string): Promise<void>;
}

export function createProductDownloadRepository(
  store = getKeyValueStore(STORES.productDownloads),
): ProductDownloadRepository {
  const key = (productId: string, version: string) =>
    `product:${productId}:version:${encodeURIComponent(version)}`;

  return {
    find(productId, version) {
      return store.get<ProductDownload>(key(productId, version));
    },
    async save(download) {
      await store.set(key(download.productId, download.version), download);
    },
    async remove(productId, version) {
      await store.remove(key(productId, version));
    },
  };
}

let repository: ProductDownloadRepository | null = null;

export function getProductDownloadRepository(): ProductDownloadRepository {
  if (repository === null) repository = createProductDownloadRepository();
  return repository;
}
