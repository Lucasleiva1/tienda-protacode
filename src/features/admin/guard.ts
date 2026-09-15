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

/** Para páginas: si no hay sesión, manda al login. */
export async function requireAdminPage(): Promise<void> {
  if (!(await hasValidSession())) {
    redirect("/admin/login");
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
