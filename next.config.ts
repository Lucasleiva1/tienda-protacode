import type { NextConfig } from "next";

const BASE_PERMISSIONS = "camera=(), microphone=(), geolocation=()";

/**
 * Páginas que muestran el botón de Google Identity Services.
 *
 * Google necesita recibir el origen del sitio en el Referer: con `no-referrer` el
 * botón no funciona. `strict-origin-when-cross-origin` envía solo el dominio (nunca
 * la ruta) a otros sitios. Para probar por http://localhost Google indica usar
 * `no-referrer-when-downgrade`.
 */
const GOOGLE_SIGN_IN_PAGES = [
  "/cuenta/:path*",
  "/checkout",
  "/comprar/:path*",
] as const;

const googleReferrerPolicy =
  process.env.NODE_ENV === "development"
    ? "no-referrer-when-downgrade"
    : "strict-origin-when-cross-origin";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // La foto del producto y los comprobantes viajan por Server Actions: 3 MB de
      // archivo más el sobre del formulario. El límite por defecto (1 MB) los rechazaba.
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: BASE_PERMISSIONS },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      ...GOOGLE_SIGN_IN_PAGES.map((source) => ({
        source,
        headers: [
          { key: "Referrer-Policy", value: googleReferrerPolicy },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          {
            key: "Permissions-Policy",
            value: `${BASE_PERMISSIONS}, identity-credentials-get=(self "https://accounts.google.com")`,
          },
        ],
      })),
      {
        source: "/compras/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/api/downloads/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/api/admin/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
        ],
      },
      {
        // El service worker del panel siempre se revalida para tomar cambios.
        source: "/admin-sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
