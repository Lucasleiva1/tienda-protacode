/**
 * Manifiesto de la app instalable del panel.
 *
 * Vive dentro de /admin a propósito: solo las páginas del panel lo enlazan, así la
 * tienda pública no se ofrece como aplicación. No contiene datos privados.
 */

export const dynamic = "force-static";

export function GET() {
  const manifest = {
    id: "/admin",
    name: "Prota Code Admin",
    short_name: "Prota Admin",
    description: "Pedidos y pagos por verificar de Prota Code.",
    lang: "es-AR",
    dir: "ltr",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: "#111827",
    theme_color: "#111827",
    categories: ["business", "productivity"],
    icons: [
      { src: "/admin-pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/admin-pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/admin-pwa/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Pagos por verificar",
        short_name: "Verificar",
        url: "/admin/pedidos?estado=awaiting_verification",
        icons: [{ src: "/admin-pwa/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
