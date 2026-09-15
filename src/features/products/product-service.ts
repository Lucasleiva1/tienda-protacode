import "server-only";
import { getProductRepository } from "@/features/products/product-repository";
import { CATEGORIES, CURRENCIES, PLATFORMS } from "@/types/product";
import type {
  Category,
  Currency,
  DownloadType,
  LicenseType,
  Platform,
  Product,
  ProductFeature,
  ProductImage,
  ProductRequirement,
} from "@/types/product";

/**
 * Alta y edición de programas.
 *
 * Toda la validación vive acá, del lado del servidor. El formulario del Admin
 * también valida, pero eso es una comodidad: la validación que manda es esta.
 */

/** Lo que manda el formulario del Admin. Precios en centavos. */
export interface ProductInput {
  readonly name: string;
  readonly slug: string;
  readonly appId: string;
  readonly shortDescription: string;
  readonly description: string;
  readonly priceArs: number;
  readonly priceUsd: number;
  readonly currency: Currency;
  readonly platforms: readonly Platform[];
  readonly version: string;
  readonly category: Category;
  readonly licenseType: LicenseType;
  readonly downloadType: DownloadType;
  readonly heroImage: ProductImage | null;
  readonly images: readonly ProductImage[];
  readonly features: readonly ProductFeature[];
  readonly useCases: readonly string[];
  readonly systemRequirements: readonly ProductRequirement[];
  readonly licenseNote: string | null;
  readonly published: boolean;
  readonly featured: boolean;
  readonly sortOrder: number;
}

export type ProductErrors = Partial<Record<keyof ProductInput, string>>;

export type SaveProductResult =
  | { readonly ok: true; readonly product: Product }
  | { readonly ok: false; readonly errors: ProductErrors };

/** Deja el texto apto para una URL: minúsculas, sin acentos, con guiones. */
export function normalizeSlug(valor: string): string {
  return valor
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const MAX_NOMBRE = 80;
const MAX_CORTA = 160;
const MAX_LARGA = 4000;

function limpio(valor: string): string {
  return valor.trim().replace(/\s+/g, " ");
}

/**
 * Valida y arma el producto.
 *
 * `idActual` es `null` cuando se crea. Al editar lleva el id, así el propio producto
 * no se cuenta como duplicado de sí mismo al chequear slug y appId.
 */
async function construir(
  input: ProductInput,
  idActual: string | null,
): Promise<SaveProductResult> {
  const errors: Record<string, string> = {};

  const name = limpio(input.name);
  const slug = normalizeSlug(input.slug === "" ? input.name : input.slug);
  const appId = normalizeSlug(input.appId);
  const shortDescription = limpio(input.shortDescription);
  const description = input.description.trim();
  const version = limpio(input.version);

  if (name.length < 2) errors.name = "Escribí el nombre del programa.";
  else if (name.length > MAX_NOMBRE) errors.name = `Máximo ${MAX_NOMBRE} caracteres.`;

  if (slug === "") errors.slug = "El slug no puede quedar vacío.";

  if (appId === "") errors.appId = "El App ID es obligatorio.";

  if (shortDescription.length < 5)
    errors.shortDescription = "Escribí una descripción corta.";
  else if (shortDescription.length > MAX_CORTA)
    errors.shortDescription = `Máximo ${MAX_CORTA} caracteres.`;

  if (description.length < 10) errors.description = "Escribí la descripción completa.";
  else if (description.length > MAX_LARGA)
    errors.description = `Máximo ${MAX_LARGA} caracteres.`;

  if (version === "") errors.version = "Indicá la versión.";

  if (!Number.isInteger(input.priceArs) || input.priceArs < 0)
    errors.priceArs = "El precio en pesos no es válido.";
  if (!Number.isInteger(input.priceUsd) || input.priceUsd < 0)
    errors.priceUsd = "El precio en dólares no es válido.";

  if (!CURRENCIES.includes(input.currency)) errors.currency = "Moneda no válida.";
  if (!CATEGORIES.includes(input.category)) errors.category = "Categoría no válida.";

  const platforms = input.platforms.filter((p) => PLATFORMS.includes(p));
  if (platforms.length === 0)
    errors.platforms = "Elegí al menos un sistema operativo.";

  if (!Number.isFinite(input.sortOrder))
    errors.sortOrder = "El orden tiene que ser un número.";

  // Unicidad de slug y appId contra el resto del catálogo.
  const repositorio = getProductRepository();
  const existentes = await repositorio.findAll();
  const otros = existentes.filter((producto) => producto.id !== idActual);

  if (errors.slug === undefined && otros.some((p) => p.slug === slug)) {
    errors.slug = `Ya hay otro programa con el slug "${slug}".`;
  }
  if (errors.appId === undefined && otros.some((p) => p.appId === appId)) {
    errors.appId = `Ya hay otro programa con el App ID "${appId}".`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const ahora = new Date().toISOString();
  const anterior = idActual === null ? null : await repositorio.findById(idActual);

  const product: Product = {
    id: anterior?.id ?? crypto.randomUUID(),
    slug,
    appId,
    name,
    shortDescription,
    description,
    price: {
      ARS: { amount: input.priceArs, currency: "ARS" },
      USD: { amount: input.priceUsd, currency: "USD" },
    },
    currency: input.currency,
    platforms,
    version,
    licenseType: input.licenseType,
    images: input.images,
    heroImage: input.heroImage,
    downloadType: input.downloadType,
    category: input.category,
    features: input.features.filter((f) => f.name.trim() !== ""),
    useCases: input.useCases.map(limpio).filter((c) => c !== ""),
    systemRequirements: input.systemRequirements.filter(
      (r) => r.label.trim() !== "",
    ),
    licenseNote:
      input.licenseNote === null || input.licenseNote.trim() === ""
        ? null
        : input.licenseNote.trim(),
    published: input.published,
    featured: input.featured,
    sortOrder: Math.round(input.sortOrder),
    archived: anterior?.archived ?? false,
    createdAt: anterior?.createdAt ?? ahora,
    updatedAt: ahora,
  };

  await repositorio.save(product);
  return { ok: true, product };
}

export function createProduct(input: ProductInput): Promise<SaveProductResult> {
  return construir(input, null);
}

export function updateProduct(
  id: string,
  input: ProductInput,
): Promise<SaveProductResult> {
  return construir(input, id);
}

/** Cambia una bandera sin tocar el resto del producto. */
async function marcar(
  id: string,
  cambios: Partial<Pick<Product, "published" | "featured" | "archived">>,
): Promise<Product | null> {
  const repositorio = getProductRepository();
  const producto = await repositorio.findById(id);
  if (producto === null) return null;

  const actualizado: Product = {
    ...producto,
    ...cambios,
    updatedAt: new Date().toISOString(),
  };
  await repositorio.save(actualizado);
  return actualizado;
}

export function publishProduct(id: string) {
  return marcar(id, { published: true });
}

export function unpublishProduct(id: string) {
  return marcar(id, { published: false });
}

/**
 * Archiva: lo retira de la tienda sin borrarlo.
 *
 * Se despublica junto con el archivado para que no quede un estado raro (archivado
 * pero "publicado") en la lista del Admin.
 */
export function archiveProduct(id: string) {
  return marcar(id, { archived: true, published: false });
}

export function unarchiveProduct(id: string) {
  return marcar(id, { archived: false });
}

export function setFeatured(id: string, featured: boolean) {
  return marcar(id, { featured });
}

export type DeleteProductResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: "not_found" | "not_archived" };

/**
 * El borrado permanente exige un archivado previo. Conserva aparte pedidos,
 * licencias y descargas para no romper compras históricas.
 */
export async function deleteArchivedProduct(id: string): Promise<DeleteProductResult> {
  const repositorio = getProductRepository();
  const producto = await repositorio.findById(id);
  if (producto === null) return { ok: false, reason: "not_found" };
  if (!producto.archived) return { ok: false, reason: "not_archived" };
  await repositorio.remove(id);
  return { ok: true };
}
