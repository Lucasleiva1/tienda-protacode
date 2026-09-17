/**
 * Genera un par de claves VAPID para las notificaciones push del panel.
 *
 *     npm run push:claves
 *
 * Copiá las dos líneas en las variables de entorno (Netlify o .env.local). La
 * clave privada es un secreto: no la subas al repositorio ni la compartas.
 * Cambiar las claves obliga a volver a activar las notificaciones en cada celular.
 */

import { generateVapidKeys } from "../src/lib/push/web-push-sender";

const keys = generateVapidKeys();

process.stdout.write(
  [
    "Claves VAPID nuevas (guardalas fuera del repositorio):",
    "",
    `VAPID_PUBLIC_KEY=${keys.publicKey}`,
    `VAPID_PRIVATE_KEY=${keys.privateKey}`,
    "VAPID_SUBJECT=mailto:tu-email@ejemplo.com",
    "",
    "Reemplazá VAPID_SUBJECT por un email tuyo (mailto:) o por la URL https de la tienda.",
    "",
  ].join("\n"),
);
