import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { siteConfig } from "@/config/site";
import "./globals.css";

/*
  Tipografia oficial de Prota Code, segun el manual de marca:
  Barlow Condensed para titulos y acentos, Barlow para textos y descripciones.
*/
const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-barlow",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — Software sin alquiler`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#060d1a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es-AR"
      data-scroll-behavior="smooth"
      className={`${barlow.variable} ${barlowCondensed.variable}`}
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
