/**
 * Modelo de producto de Prota Code.
 *
 * Un producto es un programa que se vende una sola vez: el comprador obtiene una
 * licencia de uso permanente sobre la versión que compró. No hay suscripciones ni
 * actualizaciones prometidas.
 */

export const CURRENCIES = ["ARS", "USD"] as const;

export type Currency = (typeof CURRENCIES)[number];

/**
 * Importe expresado en la unidad mínima de la moneda (centavos).
 *
 * Se guardan enteros a propósito: sumar precios con decimales en coma flotante
 * arrastra errores de redondeo (0.1 + 0.2 !== 0.3) y eso terminaría en un total
 * de carrito equivocado. Para mostrarlo se usa `formatMoney()`.
 */
export interface Money {
  /** Centavos. 2490000 = 24.900,00 */
  readonly amount: number;
  readonly currency: Currency;
}

/**
 * Un importe por cada moneda soportada.
 *
 * Es un mapped type sobre `Currency` a propósito: si mañana se agrega una moneda,
 * TypeScript marca error en todos los productos que no la definan, en vez de
 * dejar precios faltando en silencio.
 */
export type PriceByCurrency = { readonly [C in Currency]: Money };

export const PLATFORMS = ["windows", "macos", "linux"] as const;

export type Platform = (typeof PLATFORMS)[number];

/**
 * Tipo de licencia.
 *
 * Hoy existe una sola: pago único, uso permanente sobre la versión comprada.
 * Queda como unión para poder agregar variantes sin cambiar la forma del modelo.
 */
export type LicenseType = "perpetual";

/** Cómo se le entrega el archivo al comprador. */
export type DownloadType = "installer" | "portable" | "archive";

export interface ProductImage {
  /** Ruta pública, dentro de `public/`. */
  readonly src: string;
  /** Texto alternativo. Obligatorio: sin esto la imagen no es accesible. */
  readonly alt: string;
}

/**
 * Categorias del catalogo.
 *
 * Son pocas y a proposito: cada una tiene que corresponder a productos reales.
 * El filtro del catalogo se arma leyendo las categorias que de verdad estan en uso,
 * no esta lista completa, asi que agregar una aca no ensucia la interfaz.
 */
export const CATEGORIES = [
  "productividad",
  "diseno",
  "organizacion",
  "comercio",
  "utilidades",
] as const;

export type Category = (typeof CATEGORIES)[number];

/** Una funcion del programa: que es y para que sirve, en una linea. */
export interface ProductFeature {
  readonly name: string;
  readonly description: string;
}

/**
 * Un requisito tecnico, como par etiqueta/valor.
 *
 * Es a proposito generico en vez de campos fijos (memoria, disco, procesador):
 * cada programa informa solo lo que de verdad se sabe, sin dejar huecos ni
 * obligar a inventar un dato para completar una ficha.
 */
export interface ProductRequirement {
  readonly label: string;
  readonly value: string;
}

export interface Product {
  readonly id: string;

  /** Identificador de la URL (/productos/<slug>). Único. */
  readonly slug: string;

  /**
   * Identificador de la aplicación en RXW-CORE.
   *
   * INMUTABLE. Es la llave con la que RXW-CORE emite y valida las licencias.
   * Cambiarlo después de haber vendido deja huérfanas las licencias ya emitidas.
   * Puede ser distinto del slug: slug `whisper` / appId `whisper-solution`.
   */
  readonly appId: string;

  readonly name: string;

  /** Una línea, para listados y tarjetas. */
  readonly shortDescription: string;

  /** Texto largo, para la ficha del producto. */
  readonly description: string;

  /** Precio en cada moneda soportada. */
  readonly price: PriceByCurrency;

  /** Moneda que se muestra por defecto para este producto. */
  readonly currency: Currency;

  readonly platforms: readonly Platform[];

  /** Versión que se vende hoy. La licencia es permanente sobre ESTA versión. */
  readonly version: string;

  readonly licenseType: LicenseType;

  readonly images: readonly ProductImage[];

  /** Imagen principal. `null` mientras no exista el archivo real. */
  readonly heroImage: ProductImage | null;

  readonly downloadType: DownloadType;

  readonly category: Category;

  /** Funciones principales. Puede estar vacio si todavia no se definieron. */
  readonly features: readonly ProductFeature[];

  /** Para que se usa, en pocas palabras. Puede estar vacio. */
  readonly useCases: readonly string[];

  /** Requisitos confirmados. Solo lo que se sabe; nunca se rellena de mas. */
  readonly systemRequirements: readonly ProductRequirement[];

  /**
   * Excepcion a las condiciones de licencia estandar.
   *
   * `null` significa que aplica la licencia general y no hace falta aclarar nada.
   * El texto general vive en el componente de licencia, no repetido por producto.
   */
  readonly licenseNote: string | null;

  /** Si es `false`, no debe aparecer nunca en la tienda publica. */
  readonly published: boolean;

  /** Si es `true`, puede destacarse en la Home. Solo aplica si está publicado. */
  readonly featured: boolean;

  /**
   * Orden de aparición en la tienda, de menor a mayor.
   *
   * Se numera de a 10 (10, 20, 30) para poder meter un programa en el medio sin
   * tener que renumerar todos los demás.
   */
  readonly sortOrder: number;

  /**
   * Retirado del catálogo sin borrarlo.
   *
   * Un producto archivado no se vende ni se muestra, pero sigue existiendo en el
   * Admin y los pedidos viejos que lo incluyen siguen teniendo sentido. Es la
   * alternativa al borrado: un programa que ya se vendió no puede desaparecer.
   */
  readonly archived: boolean;

  /** ISO 8601 en UTC. */
  readonly createdAt: string;
  /** ISO 8601 en UTC. */
  readonly updatedAt: string;
}
