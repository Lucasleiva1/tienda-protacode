"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, NO_AUTORIZADO } from "@/features/admin/guard";
import {
  archiveProduct,
  createProduct,
  deleteArchivedProduct,
  publishProduct,
  setFeatured,
  unarchiveProduct,
  unpublishProduct,
  updateProduct,
  type ProductErrors,
  type ProductInput,
} from "@/features/products/product-service";

/**
 * Acciones del Admin sobre los programas.
 *
 * CADA UNA verifica la sesión por su cuenta. No alcanza con que las páginas estén
 * protegidas: una acción de servidor se puede invocar directamente desde afuera, así
 * que la puerta va acá adentro y no solo en la navegación.
 */

export type ProductActionResult =
  | { readonly ok: true; readonly id: string; readonly slug: string }
  | { readonly ok: false; readonly errors?: ProductErrors; readonly message?: string };

/**
 * Refresca lo que ve el público.
 *
 * Se refresca desde la raíz hacia abajo: un cambio de precio o de orden toca la
 * Home, el catálogo y la ficha al mismo tiempo, y así no hay que acordarse de
 * enumerar cada ruta.
 */
function refrescarTienda(): void {
  revalidatePath("/", "layout");
}

export async function saveProductAction(
  id: string | null,
  input: ProductInput,
): Promise<ProductActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };

  const resultado =
    id === null ? await createProduct(input) : await updateProduct(id, input);

  if (!resultado.ok) return { ok: false, errors: resultado.errors };

  refrescarTienda();
  revalidatePath("/admin/programas");

  return { ok: true, id: resultado.product.id, slug: resultado.product.slug };
}

export type EstadoAccion = { readonly ok: boolean; readonly message?: string };

async function cambiarEstado(
  operacion: () => Promise<unknown>,
): Promise<EstadoAccion> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };

  const resultado = await operacion();
  if (resultado === null) {
    return { ok: false, message: "No encontramos ese programa." };
  }

  refrescarTienda();
  revalidatePath("/admin/programas");
  return { ok: true };
}

export async function publishAction(id: string): Promise<EstadoAccion> {
  return cambiarEstado(() => publishProduct(id));
}

export async function unpublishAction(id: string): Promise<EstadoAccion> {
  return cambiarEstado(() => unpublishProduct(id));
}

export async function archiveAction(id: string): Promise<EstadoAccion> {
  return cambiarEstado(() => archiveProduct(id));
}

export async function unarchiveAction(id: string): Promise<EstadoAccion> {
  return cambiarEstado(() => unarchiveProduct(id));
}

export async function featureAction(
  id: string,
  featured: boolean,
): Promise<EstadoAccion> {
  return cambiarEstado(() => setFeatured(id, featured));
}

export async function deleteProductAction(id: string): Promise<EstadoAccion> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };

  const resultado = await deleteArchivedProduct(id);
  if (!resultado.ok) {
    return {
      ok: false,
      message:
        resultado.reason === "not_archived"
          ? "Archivá el programa antes de eliminarlo definitivamente."
          : "No encontramos ese programa.",
    };
  }

  refrescarTienda();
  revalidatePath("/admin/programas");
  return { ok: true };
}
