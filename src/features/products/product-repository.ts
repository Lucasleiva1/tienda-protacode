import "server-only";
import { getKeyValueStore, STORES } from "@/lib/storage/store";
import type { Product } from "@/types/product";

/**
 * Almacén de productos.
 *
 * Es la única puerta a los datos de los programas. Ni la Home, ni el Admin, ni el
 * carrito hablan con Netlify Blobs directamente: todos pasan por acá. Así, cambiar
 * dónde se guardan los datos no obliga a tocar ni una pantalla.
 *
 * Se guarda UN PRODUCTO POR CLAVE, no un archivo gigante con todos adentro: dos
 * ediciones simultáneas de programas distintos no se pisan entre sí.
 */

export interface ProductRepository {
  findAll(): Promise<readonly Product[]>;
  /** Publicados y no archivados, ordenados por `sortOrder`. Es lo que ve el público. */
  findPublished(): Promise<readonly Product[]>;
  findById(id: string): Promise<Product | null>;
  findBySlug(slug: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
  remove(id: string): Promise<void>;
}

/**
 * Orden estable.
 *
 * Primero `sortOrder`. Ante empate, por nombre, para que la lista no baile entre
 * recargas: sin este desempate, dos productos con el mismo orden podrían alternarse
 * según cómo vuelvan las claves del almacén.
 */
function ordenar(productos: readonly Product[]): readonly Product[] {
  return [...productos].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.name.localeCompare(b.name, "es") ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Completa los campos nuevos en productos guardados antes de que existieran.
 *
 * Se arregla al leer y no se reescribe el almacén: un producto viejo se comporta
 * exactamente como antes (pago, sin aportes) sin necesidad de migrar nada a mano.
 */
function normalizar<T extends Product | null>(producto: T): T {
  if (producto === null) return producto;
  const parcial = producto as Partial<Product>;
  return {
    ...producto,
    pricingType: parcial.pricingType === "free" ? "free" : "paid",
    acceptDonations: parcial.acceptDonations === true,
    donationAlias: parcial.donationAlias ?? null,
    donationQr: parcial.donationQr ?? null,
    donationAliasFont: parcial.donationAliasFont ?? null,
  } as T;
}

function createProductRepository(): ProductRepository {
  const store = getKeyValueStore(STORES.products);

  async function todos(): Promise<readonly Product[]> {
    const claves = await store.keys();
    const leidos = await Promise.all(
      claves.map((clave) => store.get<Product>(clave)),
    );
    const productos = leidos
      .filter((p): p is Product => p !== null)
      .map((p) => normalizar(p));
    return ordenar(productos);
  }

  return {
    findAll: todos,

    async findPublished() {
      const productos = await todos();
      return productos.filter(
        (producto) => producto.published && !producto.archived,
      );
    },

    async findById(id) {
      return normalizar(await store.get<Product>(id));
    },

    async findBySlug(slug) {
      const productos = await todos();
      return productos.find((producto) => producto.slug === slug) ?? null;
    },

    async save(product) {
      await store.set(product.id, product);
    },

    async remove(id) {
      await store.remove(id);
    },
  };
}

let repositorio: ProductRepository | null = null;

export function getProductRepository(): ProductRepository {
  if (repositorio === null) {
    repositorio = createProductRepository();
  }
  return repositorio;
}
