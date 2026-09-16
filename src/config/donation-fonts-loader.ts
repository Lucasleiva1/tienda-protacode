import {
  Barlow_Condensed,
  Inter,
  Lora,
  Montserrat,
  Roboto_Mono,
} from "next/font/google";
import { resolveDonationFont } from "@/config/donation-fonts";

/**
 * Carga de las tipografías del alias de aportes.
 *
 * Vive separado de la lista (`donation-fonts.ts`) porque `next/font` es una
 * transformación del compilador de Next: solo existe dentro de la app. Los scripts y
 * las pruebas usan la lista, que es TypeScript común.
 *
 * Para sumar una tipografía: agregarla a la lista y traerla acá con el mismo `key`.
 */

const inter = Inter({ subsets: ["latin"], weight: ["500", "600"], display: "swap" });
const robotoMono = Roboto_Mono({ subsets: ["latin"], weight: ["500"], display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], weight: ["600"], display: "swap" });
const lora = Lora({ subsets: ["latin"], weight: ["500"], display: "swap" });
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600"],
  display: "swap",
});

const CLASES: Record<string, string> = {
  condensada: barlowCondensed.className,
  mono: robotoMono.className,
  inter: inter.className,
  montserrat: montserrat.className,
  lora: lora.className,
};

/** Clase CSS de la tipografía elegida. Cadena vacía = la tipografía del sitio. */
export function donationFontClass(valor: string | null | undefined): string {
  const clave = resolveDonationFont(valor);
  if (clave === null) return "";
  return CLASES[clave] ?? "";
}
