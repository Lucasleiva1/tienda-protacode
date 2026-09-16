import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { siteConfig } from "@/config/site";
import { getLocale } from "@/i18n/server";
import { documentLanguage, pick } from "@/i18n/shared";
import "./globals.css";

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

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: {
      default: "Prota Code — " + pick(locale, "Software sin alquiler", "Software you own", "Software sem aluguel"),
      template: "%s | Prota Code",
    },
    description: pick(
      locale,
      siteConfig.description,
      "Desktop programs and utilities with a one-time payment. Buy once, download, and use the purchased version permanently. No subscriptions or monthly fees.", "Programas e utilitários para computador com pagamento único. Compre uma vez, baixe e use a versão adquirida de forma permanente. Sem assinaturas nem mensalidades.",
    ),
  };
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#060d1a",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <html
      lang={documentLanguage(locale)}
      data-scroll-behavior="smooth"
      className={[barlow.variable, barlowCondensed.variable].join(" ")}
    >
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
