import { CartHydrator } from "@/features/cart/CartHydrator";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

export default async function TiendaLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-foreground"
      >
        {pick(locale, "Saltar al contenido", "Skip to content", "Pular para o conteúdo")}
      </a>
      <CartHydrator />
      <Header locale={locale} />
      <div id="contenido">{children}</div>
      <Footer locale={locale} />
    </>
  );
}
