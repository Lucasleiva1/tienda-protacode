import { readMedia } from "@/features/admin/media";

/**
 * Lectura pública de las imágenes de productos.
 *
 * Solo lee. Subir y borrar pasa por las acciones del Admin, con sesión: desde el
 * navegador no se puede escribir en el almacén.
 *
 * La clave llega partida en segmentos (`products/<id>/<uuid>.webp`) y se vuelve a
 * unir acá. No se toca el sistema de archivos con esa cadena: se usa como clave del
 * almacén, así que un `..` no lleva a ningún lado.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/media/[...key]">,
) {
  const { key } = await params;
  const clave = key.join("/");

  const media = await readMedia(clave);

  if (media === null) {
    return new Response("No encontrado", { status: 404 });
  }

  const bytes = Buffer.from(media.base64, "base64");

  return new Response(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": media.contentType,
      "Content-Length": String(bytes.byteLength),
      // La clave lleva un uuid: el contenido de una clave nunca cambia.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
