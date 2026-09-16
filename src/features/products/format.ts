import { formatMoney } from "@/lib/utils/money";
import { localizeProduct } from "@/i18n/product-copy";
import { numberLocale, pick, type Locale } from "@/i18n/shared";
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

export function platformLabel(platform: Platform): string {
  return PLATFORM_LABELS[platform];
}

export function platformsLabel(platforms: readonly Platform[]): string {
  return platforms.map(platformLabel).join(" · ");
}

export function licenseLabel(
  licenseType: LicenseType,
  locale: Locale = "es",
): string {
  return licenseType === "perpetual"
    ? pick(locale, "Licencia de uso permanente", "Permanent-use license", "Licença de uso permanente")
    : licenseType;
}

/** Un programa gratuito se descarga sin comprar: no tiene precio que mostrar. */
export function isFree(product: Pick<Product, "pricingType">): boolean {
  return product.pricingType === "free";
}

/** Lo que se muestra donde iría el precio: el importe, o "GRATIS". */
export function priceLabel(product: Product, locale: Locale = "es"): string {
  return isFree(product)
    ? pick(locale, "GRATIS", "FREE", "GRÁTIS")
    : primaryPrice(product, locale);
}

/** El precio en la otra moneda. `null` cuando es gratuito: no se muestra "$ 0". */
export function secondaryPriceLabel(
  product: Product,
  locale: Locale = "es",
): string | null {
  return isFree(product) ? null : secondaryPrice(product, locale);
}

export function primaryPrice(product: Product, locale: Locale = "es"): string {
  return formatMoney(product.price[product.currency], numberLocale(locale));
}

export function secondaryPrice(product: Product, locale: Locale = "es"): string {
  const other = product.currency === "ARS" ? "USD" : "ARS";
  return formatMoney(product.price[other], numberLocale(locale));
}

const CATEGORY_LABELS: Record<Category, readonly [string, string, string]> = {
  productividad: ["Productividad", "Productivity", "Produtividade"],
  diseno: ["Diseño", "Design", "Design"],
  organizacion: ["Organización", "Organization", "Organização"],
  comercio: ["Comercio", "Retail", "Comércio"],
  utilidades: ["Utilidades", "Utilities", "Utilitários"],
};

export function categoryLabel(category: Category, locale: Locale = "es"): string {
  const [spanish, english, portuguese] = CATEGORY_LABELS[category];
  return pick(locale, spanish, english, portuguese);
}

const DOWNLOAD_LABELS: Record<DownloadType, readonly [string, string, string]> = {
  installer: ["Instalador", "Installer", "Instalador"],
  portable: ["Portable", "Portable", "Portátil"],
  archive: ["Archivo comprimido", "Compressed archive", "Arquivo compactado"],
};

export function downloadLabel(downloadType: DownloadType, locale: Locale = "es"): string {
  const [spanish, english, portuguese] = DOWNLOAD_LABELS[downloadType];
  return pick(locale, spanish, english, portuguese);
}

/** Search matches the visible translated copy and the original Spanish catalog copy. */
export function searchableText(product: Product, locale: Locale = "es"): string {
  const localized = localizeProduct(product, locale);
  const values = [product, localized].flatMap((item) => [
    item.name,
    item.shortDescription,
    item.description,
    categoryLabel(item.category, item === localized ? locale : "es"),
    ...item.useCases,
    ...item.features.map((feature) => feature.name),
  ]);
  return normalize(values.join(" "));
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
