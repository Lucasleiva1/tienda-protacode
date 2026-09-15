import { CartHydrator } from "@/features/cart/CartHydrator";
import { Footer } from "@/components/layout/Footer";
import { Header } from "@/components/layout/Header";

/**
 * Envoltorio de la tienda pública.
 *
 * El header, el footer y el carrito viven acá y no en el layout raíz, para que el
 * Admin no los herede: es un panel de trabajo, no una página de la tienda.
 */
export default function TiendaLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-accent-foreground"
      >
        Saltar al contenido
      </a>
      <CartHydrator />
      <Header />
      <div id="contenido">{children}</div>
      <Footer />
    </>
  );
}
