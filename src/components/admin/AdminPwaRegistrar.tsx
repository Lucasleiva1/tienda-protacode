"use client";

import { useEffect } from "react";

/**
 * Registra el service worker del panel.
 *
 * Su alcance es solo `/admin`: la tienda pública no queda controlada por él. No
 * guarda páginas privadas en caché; solo muestra una pantalla sin conexión y
 * recibe las notificaciones push.
 */
export function AdminPwaRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/admin-sw.js", { scope: "/admin", updateViaCache: "none" })
      .catch(() => {
        // Sin service worker el panel funciona igual como web normal.
      });
  }, []);

  return null;
}
