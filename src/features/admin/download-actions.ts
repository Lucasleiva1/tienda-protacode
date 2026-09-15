"use server";

import { revalidatePath } from "next/cache";
import {
  removeProductDownload,
  saveProductDownload,
  type ProductDownloadInput,
} from "@/features/downloads/product-download-service";
import { isAdmin, NO_AUTORIZADO } from "@/features/admin/guard";
import { getProductRepository } from "@/features/products/product-repository";

export type DownloadActionResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly message: string };

export async function associateProductDownloadAction(
  productId: string,
  version: string,
  input: ProductDownloadInput,
): Promise<DownloadActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  const product = await getProductRepository().findById(productId);
  if (product === null || product.version !== version) {
    return { ok: false, message: "El producto o la versión cambiaron. Recargá la página." };
  }
  const result = await saveProductDownload(productId, version, input);
  if (!result.ok) return result;
  revalidatePath(`/admin/programas/${productId}`);
  return { ok: true, message: "Archivo privado asociado." };
}

export async function removeProductDownloadAction(
  productId: string,
  version: string,
): Promise<DownloadActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  const product = await getProductRepository().findById(productId);
  if (product === null || product.version !== version) {
    return { ok: false, message: "El producto o la versión cambiaron. Recargá la página." };
  }
  await removeProductDownload(productId, version);
  revalidatePath(`/admin/programas/${productId}`);
  return {
    ok: true,
    message: "Asociación retirada. El Blob no se borró para preservar pedidos anteriores.",
  };
}
