/**
 * Presentación de productos.
 *
 * Convierte los valores del modelo en texto para mostrar. Vive junto a las consultas
 * para que ningún componente tenga que saber cómo se escribe "windows" en pantalla.
 */

import { formatMoney } from "@/lib/utils/money";
import type {
  Category,
  DownloadType,
  LicenseType,
  Platform,
  Product,
} from "@/types/product";

const PLATFORM_LABELS: Record<Platform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

const LICENSE_LABELS: Record<LicenseType, string> = {
  perpetual: "Licencia de uso permanente",
};

export function platformLabel(platform: Platform): string {
  return PLATFORM_LABELS[platform];
}

export function platformsLabel(platforms: readonly Platform[]): string {
  return platforms.map(platformLabel).join(" · ");
}

export function licenseLabel(licenseType: LicenseType): string {
  return LICENSE_LABELS[licenseType];
}

/** Precio en la moneda que el producto muestra por defecto. */
export function primaryPrice(product: Product): string {
  return formatMoney(product.price[product.currency]);
}

/** La otra moneda, para mostrarla como referencia secundaria. */
export function secondaryPrice(product: Product): string {
  const other = product.currency === "ARS" ? "USD" : "ARS";
  return formatMoney(product.price[other]);
}

const CATEGORY_LABELS: Record<Category, string> = {
  productividad: "Productividad",
  diseno: "Diseño",
  organizacion: "Organización",
  comercio: "Comercio",
  utilidades: "Utilidades",
};

export function categoryLabel(category: Category): string {
  return CATEGORY_LABELS[category];
}

const DOWNLOAD_LABELS: Record<DownloadType, string> = {
  installer: "Instalador",
  portable: "Portable",
  archive: "Archivo comprimido",
};

export function downloadLabel(downloadType: DownloadType): string {
  return DOWNLOAD_LABELS[downloadType];
}

/**
 * Texto sobre el que corre la búsqueda del catálogo.
 *
 * Se arma una sola vez por producto y se normaliza sin acentos, así "diseno"
 * encuentra "diseño" y "storyboard" encuentra "Storyboard Wana".
 */
export function searchableText(product: Product): string {
  return normalize(
    [
      product.name,
      product.shortDescription,
      product.description,
      categoryLabel(product.category),
      ...product.useCases,
      ...product.features.map((f) => f.name),
    ].join(" "),
  );
}

/** Minúsculas y sin acentos, para comparar lo que el usuario escribe. */
export function normalize(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
