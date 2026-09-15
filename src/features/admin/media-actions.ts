"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, NO_AUTORIZADO } from "@/features/admin/guard";
import { deleteMedia, saveProductImage } from "@/features/admin/media";

export type SubirImagenResult =
  | { readonly ok: true; readonly url: string; readonly key: string }
  | { readonly ok: false; readonly message: string };

/**
 * Sube una imagen de producto.
 *
 * Verifica la sesión antes de tocar nada: subir archivos es de las cosas que más
 * conviene tener cerradas.
 */
export async function subirImagenAction(
  productId: string,
  formData: FormData,
): Promise<SubirImagenResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) {
    return { ok: false, message: "No llegó ningún archivo." };
  }

  const resultado = await saveProductImage(productId, archivo);
  if (!resultado.ok) return resultado;

  return { ok: true, url: resultado.url, key: resultado.key };
}

export async function borrarImagenAction(
  url: string,
): Promise<{ readonly ok: boolean; readonly message?: string }> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };

  // La url pública es /api/media/<clave>. Se recorta el prefijo para obtenerla.
  const prefijo = "/api/media/";
  if (!url.startsWith(prefijo)) {
    // Una imagen que no está en el almacén (por ejemplo una ruta vieja de /public)
    // simplemente se quita del producto; no hay nada que borrar.
    return { ok: true };
  }

  await deleteMedia(url.slice(prefijo.length));
  revalidatePath("/", "layout");
  return { ok: true };
}
