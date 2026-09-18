import { cookies } from "next/headers";
import { recordVisit, visitDay } from "@/features/analytics/visits";
import { isAdmin } from "@/features/admin/guard";
import { getClientIp } from "@/lib/security/client-ip";
import { allowPersistentRequest } from "@/lib/security/persistent-rate-limit";

/**
 * Registra una visita a la tienda (una por navegador y por día).
 *
 * No cuenta:
 *   - al administrador con sesión abierta (sus propias visitas inflarían el número);
 *   - robots de buscadores y herramientas automáticas;
 *   - pedidos de otros sitios.
 *
 * La cookie `pc_visita` guarda solo la fecha del día contado. La IP se usa, hasheada
 * por el limitador, para que nadie pueda inflar el contador a mano.
 */

export const runtime = "nodejs";

const COOKIE = "pc_visita";
const ROBOTS = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|curl|wget|python|axios|node-fetch/i;

function listo(): Response {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return listo();
  if (ROBOTS.test(request.headers.get("user-agent") ?? "")) return listo();

  const dia = visitDay();
  const galletas = await cookies();
  if (galletas.get(COOKIE)?.value === dia) return listo();
  if (await isAdmin()) return listo();

  const ip = await getClientIp();
  // Tope amplio: muchos celulares comparten la IP de la compañía (CGNAT).
  if (await allowPersistentRequest("visita", `${ip}:${dia}`, 30, 26 * 60 * 60_000)) {
    await recordVisit(dia);
  }

  galletas.set(COOKIE, dia, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 2 * 24 * 60 * 60,
  });
  return listo();
}
