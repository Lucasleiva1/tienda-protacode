import "server-only";

import { headers } from "next/headers";

/**
 * IP del visitante para limitar intentos.
 *
 * En Netlify la informa `x-nf-client-connection-ip`, que agrega su borde y no puede
 * falsear el navegador. Fuera de Netlify se usa el primer valor de
 * `x-forwarded-for`. Nunca se guarda en claro: los límites la usan hasheada.
 */
export async function getClientIp(): Promise<string> {
  const store = await headers();
  const netlify = store.get("x-nf-client-connection-ip")?.trim();
  if (netlify) return netlify;
  const forwarded = store.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "desconocida";
}
