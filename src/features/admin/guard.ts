import "server-only";
import { redirect } from "next/navigation";
import { hasValidSession } from "@/features/admin/session";

/**
 * Puerta del Admin.
 *
 * Se llama al principio de CADA página privada y al principio de CADA acción que
 * modifica algo. No alcanza con esconder los botones ni con proteger solo la
 * navegación: una acción de servidor se puede invocar directamente, así que cada una
 * verifica la sesión por su cuenta.
 */

/**
 * Destino seguro después del login: solo rutas internas del panel.
 * Evita redirecciones abiertas hacia otros sitios.
 */
export function safeAdminPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 300) return "/admin";
  if (!/^\/admin(\/[A-Za-z0-9._~%-]*)*$/.test(value)) return "/admin";
  if (value.split("/").some((segment) => segment === "." || segment === "..")) return "/admin";
  if (value.startsWith("/admin/login")) return "/admin";
  return value;
}

/** Para páginas: si no hay sesión, manda al login y vuelve a `next` después. */
export async function requireAdminPage(next?: string): Promise<void> {
  if (!(await hasValidSession())) {
    const destination = safeAdminPath(next);
    redirect(
      destination === "/admin"
        ? "/admin/login"
        : `/admin/login?next=${encodeURIComponent(destination)}`,
    );
  }
}

/**
 * Para acciones que modifican datos: devuelve `false` si no hay sesión.
 *
 * No redirige: una acción tiene que poder responder "no autorizado" al que la llamó.
 */
export async function isAdmin(): Promise<boolean> {
  return hasValidSession();
}

export const NO_AUTORIZADO = "Tu sesión venció. Volvé a entrar." as const;
