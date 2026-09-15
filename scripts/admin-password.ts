/**
 * Configura el acceso al Admin.
 *
 *     npm run admin:clave
 *
 * Te pregunta el email y la contraseña que quieras, y escribe en `.env.local`:
 *
 *     ADMIN_EMAIL
 *     ADMIN_PASSWORD_HASH     ← el hash, NO la contraseña
 *     ADMIN_SESSION_SECRET    ← se genera solo, al azar
 *
 * La contraseña en sí no se guarda en ningún lado. `.env.local` está en `.gitignore`,
 * así que nunca viaja al repositorio.
 *
 * Para el sitio publicado, estas mismas tres variables se cargan en el panel de
 * Netlify (Site settings → Environment variables). El script las imprime al final
 * para que las copies.
 *
 * Aviso: la contraseña se ve mientras la escribís. Es una terminal tuya, en tu
 * máquina, y esconderla agregaría complejidad sin ganar seguridad real.
 */

import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";
import { hashPassword } from "../src/features/admin/password";

const MIN_CLAVE = 10;

/**
 * Lector de respuestas.
 *
 * Recorre las líneas de la entrada en vez de usar `question()`. Con `question()` el
 * script se moría en silencio cuando la entrada llegaba por tubería en vez de
 * escribirse a mano; así funciona igual en los dos casos.
 */
function crearLector() {
  const rl = createInterface({ input: process.stdin });
  const lineas = rl[Symbol.asyncIterator]();

  return {
    async preguntar(texto: string): Promise<string> {
      process.stdout.write(texto);
      const siguiente = await lineas.next();
      process.stdout.write("\n");
      if (siguiente.done === true) throw new Error("la entrada se cortó");
      return String(siguiente.value);
    },
    cerrar() {
      rl.close();
    },
  };
}

function salir(mensaje: string): never {
  console.error(`\n  ${mensaje}\n`);
  process.exit(1);
}

async function main() {
  const lector = crearLector();

  console.log("");
  console.log("  Configuración del Admin de Prota Code");
  console.log("  --------------------------------------");
  console.log("");

  const email = (await lector.preguntar("  Email del administrador: "))
    .trim()
    .toLowerCase();

  if (!email.includes("@")) {
    lector.cerrar();
    salir("Ese email no parece válido. No se cambió nada.");
  }

  const clave = await lector.preguntar(
    `  Contraseña (mínimo ${MIN_CLAVE} caracteres): `,
  );

  if (clave.length < MIN_CLAVE) {
    lector.cerrar();
    salir(`La contraseña necesita al menos ${MIN_CLAVE} caracteres. No se cambió nada.`);
  }

  const repetida = await lector.preguntar("  Repetí la contraseña: ");
  lector.cerrar();

  if (clave !== repetida) {
    salir("Las contraseñas no coinciden. No se cambió nada.");
  }

  console.log("  Calculando el hash…");
  const hash = await hashPassword(clave);
  const secreto = randomBytes(32).toString("hex");

  const variables = [
    `ADMIN_EMAIL=${email}`,
    `ADMIN_PASSWORD_HASH=${hash}`,
    `ADMIN_SESSION_SECRET=${secreto}`,
  ];

  // Se conserva lo que ya hubiera en .env.local que no sean estas tres variables.
  let previo = "";
  try {
    previo = await readFile(".env.local", "utf8");
  } catch {
    previo = "";
  }

  const conservado = previo
    .split("\n")
    .filter(
      (linea) =>
        !linea.startsWith("ADMIN_EMAIL=") &&
        !linea.startsWith("ADMIN_PASSWORD_HASH=") &&
        !linea.startsWith("ADMIN_SESSION_SECRET="),
    )
    .join("\n")
    .trim();

  const contenido = [conservado, variables.join("\n")]
    .filter((parte) => parte !== "")
    .join("\n");

  await writeFile(".env.local", `${contenido}\n`, "utf8");

  console.log("");
  console.log("  Listo. Se escribió .env.local");
  console.log("");
  console.log("  Reiniciá el servidor y entrá a  /admin/login");
  console.log("");
  console.log("  Para el sitio publicado, cargá estas tres variables en Netlify");
  console.log("  (Site settings -> Environment variables):");
  console.log("");
  for (const variable of variables) console.log(`    ${variable}`);
  console.log("");
}

void main().catch((error: unknown) => {
  const mensaje = error instanceof Error ? error.message : String(error);
  salir(`No se pudo completar: ${mensaje}`);
});
