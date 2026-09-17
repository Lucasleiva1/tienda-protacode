"use server";

import { redirect } from "next/navigation";
import { safeAdminPath } from "@/features/admin/guard";
import { verifyPassword } from "@/features/admin/password";
import {
  createSession,
  destroySession,
  getAdminEnv,
} from "@/features/admin/session";
import { allowPersistentRequest } from "@/lib/security/persistent-rate-limit";

export type LoginResult = { readonly error: string } | undefined;

/** Mismo texto para cualquier fallo: no se revela si falló el email o la clave. */
const CREDENCIALES = "Credenciales incorrectas.";

/**
 * Inicio de sesión del administrador.
 *
 * Detalles a propósito:
 *
 *  - El mensaje de error es siempre el mismo. Decir "ese email no existe" le
 *    regalaría a quien prueba la mitad de la respuesta.
 *  - Se verifica la contraseña aunque el email no coincida, para que fallar por
 *    email o por clave tarde lo mismo y el tiempo no filtre información.
 */
export async function loginAction(
  _previo: LoginResult,
  formData: FormData,
): Promise<LoginResult> {
  const env = getAdminEnv();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (env === null) {
    return {
      error:
        "El Admin todavía no está configurado. Ejecutá el comando de configuración de contraseña.",
    };
  }

  if (password.length > 128) return { error: CREDENCIALES };
  const [emailAllowed, globalAllowed] = await Promise.all([
    allowPersistentRequest("admin-login-email", email || "empty", 8, 15 * 60_000),
    allowPersistentRequest("admin-login-global", "single-admin", 20, 15 * 60_000),
  ]);
  if (!emailAllowed || !globalAllowed) {
    return { error: "Demasiados intentos. Esperá 15 minutos antes de volver a probar." };
  }

  const claveOk = await verifyPassword(password, env.passwordHash);
  const emailOk = email === env.email;

  if (!claveOk || !emailOk) {
    return { error: CREDENCIALES };
  }

  await createSession();
  redirect(safeAdminPath(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}
