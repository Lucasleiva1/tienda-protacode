import "server-only";

/**
 * Almacenamiento clave/valor del servidor.
 *
 * Existe esta capa para que los repositorios (productos, pedidos) no sepan dónde se
 * guardan realmente los datos. Detrás hay dos motores:
 *
 *   - **Netlify Blobs**, cuando el sitio corre publicado en Netlify.
 *   - **Archivos locales** (`.data/`), cuando trabajás en tu máquina con `npm run dev`.
 *
 * Por qué los dos: Netlify Blobs necesita el entorno de Netlify para funcionar. Sin
 * el respaldo local, no se podrían cargar ni ver productos hasta publicar el sitio.
 * Con esta capa, el Admin funciona igual en los dos lados y el código de arriba no
 * cambia ni una línea.
 */

export interface KeyValueStore {
  /** Nombre del motor activo. Se muestra en /admin/configuracion. */
  readonly engine: string;
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  /** Crea la clave de forma atómica. Devuelve false si ya existía. */
  setIfAbsent<T>(key: string, value: T): Promise<boolean>;
  /** Lee también la versión necesaria para una escritura condicional. */
  getWithVersion<T>(key: string): Promise<{ value: T; version: string } | null>;
  /** Actualiza solo si nadie modificó la versión leída. */
  setIfVersion<T>(key: string, value: T, version: string): Promise<boolean>;
  remove(key: string): Promise<void>;
  /** Todas las claves guardadas en este almacén. */
  keys(): Promise<string[]>;
}

/** `true` cuando el proceso corre dentro de Netlify. */
export function isNetlifyRuntime(): boolean {
  return process.env.NETLIFY === "true" || process.env.NETLIFY === "1";
}

/* ------------------------- motor: Netlify Blobs ------------------------- */

function createNetlifyStore(name: string): KeyValueStore {
  return {
    engine: "Netlify Blobs",

    async get<T>(key: string): Promise<T | null> {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore({ name, consistency: "strong" });
      const valor = await store.get(key, { type: "json" });
      return (valor as T | null) ?? null;
    },

    async set<T>(key: string, value: T): Promise<void> {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore({ name, consistency: "strong" });
      await store.setJSON(key, value);
    },

    async setIfAbsent<T>(key: string, value: T): Promise<boolean> {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore({ name, consistency: "strong" });
      const result = await store.setJSON(key, value, { onlyIfNew: true });
      return result.modified;
    },

    async getWithVersion<T>(key: string) {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore({ name, consistency: "strong" });
      const result = await store.getWithMetadata(key, { type: "json" });
      if (result === null || result.etag === undefined) return null;
      return { value: result.data as T, version: result.etag };
    },

    async setIfVersion<T>(key: string, value: T, version: string): Promise<boolean> {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore({ name, consistency: "strong" });
      const result = await store.setJSON(key, value, { onlyIfMatch: version });
      return result.modified;
    },

    async remove(key: string): Promise<void> {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore({ name, consistency: "strong" });
      await store.delete(key);
    },

    async keys(): Promise<string[]> {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore({ name, consistency: "strong" });
      const { blobs } = await store.list();
      return blobs.map((blob) => blob.key);
    },
  };
}

/* --------------------- motor: archivos locales (dev) --------------------- */

/**
 * Guarda un archivo JSON por clave dentro de `.data/<almacén>/`.
 *
 * SOLO DESARROLLO. Las llamadas al sistema de archivos llevan `turbopackIgnore`
 * porque son rutas que se arman en tiempo de ejecución: sin esa marca, el
 * empaquetador rastrea el proyecto entero y lo mete dentro del despliegue.
 *
 * `.data/` está listado en `.gitignore`: no viaja al repositorio y solo se usa
 * mientras desarrollás en tu máquina.
 */
function createFileStore(name: string): KeyValueStore {
  const escrituras = new Map<string, Promise<void>>();

  const carpeta = async () => {
    const path = await import("node:path");
    const fs = await import("node:fs/promises");
    const dir = path.join(process.cwd(), ".data", name);
    await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
    return { dir, path, fs };
  };

  /** Las claves se vuelven nombres de archivo: nada de barras ni `..`. */
  const archivo = (key: string) => `${encodeURIComponent(key)}.json`;

  async function conCandado<T>(key: string, trabajo: () => Promise<T>): Promise<T> {
    const anterior = escrituras.get(key) ?? Promise.resolve();
    let liberar: () => void = () => undefined;
    const actual = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    const cadena = anterior.then(() => actual);
    escrituras.set(key, cadena);
    await anterior;

    try {
      return await trabajo();
    } finally {
      liberar();
      if (escrituras.get(key) === cadena) escrituras.delete(key);
    }
  }

  async function versionDe(contenido: string): Promise<string> {
    const { createHash } = await import("node:crypto");
    return createHash("sha256").update(contenido).digest("hex");
  }

  return {
    engine: "Archivos locales (.data/)",

    async get<T>(key: string): Promise<T | null> {
      const { dir, path, fs } = await carpeta();
      try {
        const crudo = await fs.readFile(/*turbopackIgnore: true*/ path.join(dir, archivo(key)), "utf8");
        return JSON.parse(crudo) as T;
      } catch {
        return null;
      }
    },

    async set<T>(key: string, value: T): Promise<void> {
      await conCandado(key, async () => {
        const { dir, path, fs } = await carpeta();
        const destino = path.join(dir, archivo(key));
        // El temporal es único: dos requests no comparten el mismo archivo intermedio.
        const temporal = `${destino}.${crypto.randomUUID()}.tmp`;
        await fs.writeFile(/*turbopackIgnore: true*/ temporal, JSON.stringify(value, null, 2), "utf8");
        await fs.rename(/*turbopackIgnore: true*/ temporal, destino);
      });
    },

    async setIfAbsent<T>(key: string, value: T): Promise<boolean> {
      return conCandado(key, async () => {
        const { dir, path, fs } = await carpeta();
        const destino = path.join(dir, archivo(key));
        try {
          await fs.writeFile(
            /*turbopackIgnore: true*/ destino,
            JSON.stringify(value, null, 2),
            { encoding: "utf8", flag: "wx" },
          );
          return true;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
          throw error;
        }
      });
    },

    async getWithVersion<T>(key: string) {
      const { dir, path, fs } = await carpeta();
      try {
        const crudo = await fs.readFile(/*turbopackIgnore: true*/ path.join(dir, archivo(key)), "utf8");
        return { value: JSON.parse(crudo) as T, version: await versionDe(crudo) };
      } catch {
        return null;
      }
    },

    async setIfVersion<T>(key: string, value: T, version: string): Promise<boolean> {
      return conCandado(key, async () => {
        const { dir, path, fs } = await carpeta();
        const destino = path.join(dir, archivo(key));
        let actual: string;
        try {
          actual = await fs.readFile(/*turbopackIgnore: true*/ destino, "utf8");
        } catch {
          return false;
        }
        if ((await versionDe(actual)) !== version) return false;

        const temporal = `${destino}.${crypto.randomUUID()}.tmp`;
        await fs.writeFile(/*turbopackIgnore: true*/ temporal, JSON.stringify(value, null, 2), "utf8");
        await fs.rename(/*turbopackIgnore: true*/ temporal, destino);
        return true;
      });
    },

    async remove(key: string): Promise<void> {
      const { dir, path, fs } = await carpeta();
      try {
        await fs.unlink(/*turbopackIgnore: true*/ path.join(dir, archivo(key)));
      } catch {
        // Borrar algo que no está no es un error.
      }
    },

    async keys(): Promise<string[]> {
      const { dir, fs } = await carpeta();
      try {
        const nombres = await fs.readdir(/*turbopackIgnore: true*/ dir);
        return nombres
          .filter((n) => n.endsWith(".json"))
          .map((n) => decodeURIComponent(n.slice(0, -".json".length)));
      } catch {
        return [];
      }
    },
  };
}

const cache = new Map<string, KeyValueStore>();

/** Devuelve el almacén con ese nombre, con el motor que corresponda al entorno. */
export function getKeyValueStore(name: string): KeyValueStore {
  const existente = cache.get(name);
  if (existente !== undefined) return existente;

  const store = isNetlifyRuntime()
    ? createNetlifyStore(name)
    : createFileStore(name);

  cache.set(name, store);
  return store;
}

/** Nombres de los almacenes. Centralizados para no escribirlos sueltos por ahí. */
export const STORES = {
  settings: "prota-code-settings",
  customers: "prota-code-customers",
  customerVerifications: "prota-code-customer-verifications",
  rateLimits: "prota-code-rate-limits",
  products: "prota-code-products",
  orders: "prota-code-orders",
  /** Contador PC-XXXX e índices auxiliares. Separado: `orders` solo guarda pedidos. */
  orderReferences: "prota-code-order-references",
  payments: "prota-code-payments",
  /** Comprobantes privados. Nunca se sirven sin sesión Admin. */
  paymentProofs: "prota-code-payment-proofs",
  pushSubscriptions: "prota-code-push-subscriptions",
  fulfillment: "prota-code-fulfillment",
  purchaseAccess: "prota-code-purchase-access",
  productDownloads: "prota-code-product-downloads",
  downloads: "prota-code-downloads",
  media: "prota-code-media",
} as const;
