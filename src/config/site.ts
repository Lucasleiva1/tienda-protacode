/**
 * Configuración de marca y de sitio.
 *
 * Todo dato reutilizable de Prota Code sale de acá. Nada de textos de marca sueltos
 * dentro de los componentes.
 */

import type { Currency } from "@/types/product";

export interface NavItem {
  readonly label: string;
  readonly href: string;
}

export interface SiteContact {
  readonly email: string;
}

export interface BrandAsset {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
}

export interface SiteConfig {
  readonly name: string;
  readonly description: string;
  /** Idioma y región. Se usa en `<html lang>` y para formatear los precios. */
  readonly locale: string;
  readonly defaultCurrency: Currency;
  readonly navigation: readonly NavItem[];
  /** `null` a propósito: no se inventan mails, teléfonos, redes ni URLs. */
  readonly contact: SiteContact | null;
  /** Assets reales de la marca. Las medidas son las del archivo original. */
  readonly logo: BrandAsset;
  readonly cover: BrandAsset;
}

export const siteConfig: SiteConfig = {
  name: "Prota Code",
  description:
    "Programas y utilidades de escritorio con pago único. Comprás una vez, descargás y usás la versión adquirida de forma permanente. Sin suscripciones ni cuotas mensuales.",
  locale: "es-AR",
  defaultCurrency: "ARS",

  /*
    `Programas` y `Soporte` apuntan a secciones de esta misma página. Todavía no
    existen las rutas `/programas` ni `/soporte`, y un enlace roto es peor que un
    ancla honesta. Cuando existan, se cambia acá y en ningún otro lado.
  */
  navigation: [
    { label: "Inicio", href: "/" },
    { label: "Programas", href: "/programas" },
    { label: "Soporte", href: "/#preguntas" },
  ],

  contact: null,

  logo: {
    src: "/marca/logo.png",
    alt: "Prota Code",
    width: 1206,
    height: 1305,
  },

  cover: {
    src: "/marca/portada.png",
    alt: "Caja de Prota Code sobre una tarima iluminada, rodeada de pantallas de aplicaciones.",
    width: 1672,
    height: 941,
  },
};
