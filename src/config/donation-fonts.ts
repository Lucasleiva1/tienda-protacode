/**
 * Tipografías disponibles para el alias de aportes.
 *
 * El alias es un dato que la persona copia a mano en su banco, así que conviene
 * poder elegir cómo se ve: una de ancho fijo evita confundir 0 con O, y otras
 * acompañan mejor el diseño de cada programa.
 *
 * ACÁ NO SE CARGAN FUENTES: este archivo es solo la lista y la validación, y lo usan
 * tanto el servidor como el Admin. Las fuentes de verdad se cargan en
 * `donation-fonts-loader.ts`, que solo funciona dentro de la app de Next.
 *
 * La lista es cerrada a propósito: el producto guarda una CLAVE de esta tabla y no
 * un nombre libre, así nadie puede pedir desde el Admin una tipografía que el sitio
 * no carga.
 */

export interface DonationFontOption {
  /** Lo que se guarda en el producto. `sitio` equivale a "sin elección". */
  readonly key: string;
  /** Lo que se lee en el selector del Admin. */
  readonly label: string;
}

export const DEFAULT_DONATION_FONT = "sitio";

export const DONATION_FONTS: readonly DonationFontOption[] = [
  { key: "sitio", label: "La del sitio (Barlow)" },
  { key: "condensada", label: "Condensada (Barlow Condensed)" },
  { key: "mono", label: "Ancho fijo (Roboto Mono)" },
  { key: "inter", label: "Inter" },
  { key: "montserrat", label: "Montserrat" },
  { key: "lora", label: "Serif (Lora)" },
];

const CLAVES = new Set(DONATION_FONTS.map((fuente) => fuente.key));

/**
 * Devuelve una clave válida, o `null` para la tipografía del sitio.
 *
 * Un valor desconocido no es un error que frene el guardado: simplemente cae en la
 * tipografía del sitio.
 */
export function resolveDonationFont(valor: string | null | undefined): string | null {
  if (typeof valor !== "string") return null;
  if (valor === DEFAULT_DONATION_FONT) return null;
  return CLAVES.has(valor) ? valor : null;
}
