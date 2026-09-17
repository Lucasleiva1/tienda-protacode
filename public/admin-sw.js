/*
 * Service worker del panel de Prota Code (alcance: /admin).
 *
 * - Recibe las notificaciones push de pagos informados.
 * - Al tocar una notificación abre el pedido dentro del panel.
 * - Sin conexión muestra una pantalla propia. NO guarda en caché páginas ni datos
 *   privados: todo lo demás va siempre a la red.
 */

const CACHE = "prota-admin-v1";
const OFFLINE_URL = "/admin-offline.html";
const PRECACHE = [OFFLINE_URL, "/admin-pwa/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("prota-admin-") && key !== CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || request.mode !== "navigate") return;
  event.respondWith(
    fetch(request).catch(() =>
      caches.match(OFFLINE_URL).then((response) => response || Response.error()),
    ),
  );
});

/** Solo rutas del panel en este mismo sitio. */
function safeAdminUrl(value) {
  if (typeof value !== "string") return "/admin";
  try {
    const url = new URL(value, self.location.origin);
    if (url.origin !== self.location.origin || !url.pathname.startsWith("/admin")) return "/admin";
    return url.pathname + url.search;
  } catch {
    return "/admin";
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title !== "" ? data.title : "Prota Code Admin";
  const options = {
    body: typeof data.body === "string" ? data.body : "",
    icon: "/admin-pwa/icon-192.png",
    badge: "/admin-pwa/badge-96.png",
    data: { url: safeAdminUrl(data.url) },
    requireInteraction: false,
  };
  if (typeof data.tag === "string" && data.tag !== "") {
    options.tag = data.tag;
    options.renotify = true;
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    safeAdminUrl(event.notification.data && event.notification.data.url),
    self.location.origin,
  ).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin && url.pathname.startsWith("/admin")) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
              return;
            } catch {
              // Una ventana no controlada no se puede navegar: se abre otra.
            }
          }
          break;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
