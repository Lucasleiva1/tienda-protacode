import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { ScryptOptions } from "node:crypto";
import { promisify } from "node:util";

/**
 * Hash de la contraseña del administrador.
 *
 * Se usa `scrypt`, que está pensado para contraseñas: es deliberadamente lento y
 * consume memoria, así que probar millones de combinaciones sale carísimo. NO se usa
 * SHA-256 ni MD5 sobre la contraseña: esos están hechos para ser rápidos, que es
 * exactamente lo contrario de lo que hace falta acá.
 *
 * La contraseña real no se guarda nunca, ni en el código, ni en el repositorio.
 * Solo vive el hash, en una variable de entorno.
 */

/*
  `promisify` no conserva la firma que acepta opciones, así que se declara a mano.
  Sin esto, TypeScript rechaza el cuarto argumento con los parámetros de costo.
*/
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

/** Costo del cálculo. Más alto = más lento de romper y de verificar. */
const N = 16384;
const r = 8;
const p = 1;
const LARGO = 64;

/*
  Formato guardado: `scrypt:N:r:p:salt:hash`, todo en hexadecimal.

  El separador es `:` y no `$` por un motivo concreto: los archivos `.env` expanden
  `$algo` como si fuera una variable, así que un hash con `$` adentro llegaba
  mutilado y el login fallaba siempre.
*/
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivada = await scryptAsync(password.normalize("NFKC"), salt, LARGO, {
    N,
    r,
    p,
  });

  return ["scrypt", N, r, p, salt.toString("hex"), derivada.toString("hex")].join(
    ":",
  );
}

/**
 * Compara una contraseña contra el hash guardado.
 *
 * La comparación es de tiempo constante: comparar con `===` filtraría información
 * por cuánto tarda en fallar.
 */
export async function verifyPassword(
  password: string,
  guardado: string,
): Promise<boolean> {
  const partes = guardado.split(":");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;

  const [, nTexto, rTexto, pTexto, saltHex, hashHex] = partes;
  if (
    nTexto === undefined ||
    rTexto === undefined ||
    pTexto === undefined ||
    saltHex === undefined ||
    hashHex === undefined
  ) {
    return false;
  }

  try {
    const esperado = Buffer.from(hashHex, "hex");
    const derivada = await scryptAsync(
      password.normalize("NFKC"),
      Buffer.from(saltHex, "hex"),
      esperado.length,
      { N: Number(nTexto), r: Number(rTexto), p: Number(pTexto) },
    );

    return derivada.length === esperado.length && timingSafeEqual(derivada, esperado);
  } catch {
    return false;
  }
}
