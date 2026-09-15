import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Sesión del administrador.
 *
 * La sesión es una cookie firmada: guarda cuándo vence y una firma hecha con un
 * secreto que solo conoce el servidor. Si alguien edita la cookie para estirarse el
 * vencimiento, la firma deja de coincidir y la sesión se cae.
 *
 * La cookie es `HttpOnly`, así que el JavaScript de la página no puede leerla; y
 * `Secure` en producción, así que no viaja fuera de HTTPS. NO se usa `localStorage`
 * para la sesión: cualquier script de la página podría leerla ahí.
 */

const COOKIE = "pc_admin";
const DURACION_HORAS = 8;

export interface AdminEnv {
  readonly email: string;
  readonly passwordHash: string;
  readonly sessionSecret: string;
}

/**
 * Lee la configuración del administrador.
 *
 * Devuelve `null` si falta algo, y en ese caso NO se puede iniciar sesión. Es a
 * propósito: sin configuración no hay admin, en vez de un admin con clave por
 * defecto que sería una puerta abierta.
 */
export function getAdminEnv(): AdminEnv | null {
  const email = process.env.ADMIN_EMAIL;
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;

  if (
    email === undefined ||
    passwordHash === undefined ||
    sessionSecret === undefined ||
    email.trim() === "" ||
    passwordHash.trim() === "" ||
    sessionSecret.length < 32
  ) {
    return null;
  }

  return { email: email.trim().toLowerCase(), passwordHash, sessionSecret };
}

function firmar(payload: string, secreto: string): string {
  return createHmac("sha256", secreto).update(payload).digest("hex");
}

/** Crea la cookie de sesión. Se llama solo después de validar la contraseña. */
export async function createSession(): Promise<void> {
  const env = getAdminEnv();
  if (env === null) return;

  const vence = Date.now() + DURACION_HORAS * 60 * 60 * 1000;
  const payload = String(vence);
  const valor = `${payload}.${firmar(payload, env.sessionSecret)}`;

  const store = await cookies();
  store.set(COOKIE, valor, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_HORAS * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

/** `true` solo si la cookie existe, la firma es válida y no venció. */
export async function hasValidSession(): Promise<boolean> {
  const env = getAdminEnv();
  if (env === null) return false;

  const valor = (await cookies()).get(COOKIE)?.value;
  if (valor === undefined) return false;

  const corte = valor.lastIndexOf(".");
  if (corte <= 0) return false;

  const payload = valor.slice(0, corte);
  const firma = valor.slice(corte + 1);
  const esperada = firmar(payload, env.sessionSecret);

  if (firma.length !== esperada.length) return false;
  if (!timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return false;

  const vence = Number(payload);
  return Number.isFinite(vence) && vence > Date.now();
}
