import { Faq } from "@/components/home/Faq";
import { FeaturedProduct } from "@/components/home/FeaturedProduct";
import { FinalCta } from "@/components/home/FinalCta";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ProductShowcase } from "@/components/home/ProductShowcase";
import { SoftwareWithoutRent } from "@/components/home/SoftwareWithoutRent";

/*
  Se arma en cada visita: el catálogo lo administra el Admin y tiene que
  reflejarse apenas se guarda un cambio.
*/
export const dynamic = "force-dynamic";

/**
 * Home de Prota Code.
 *
 * Solo el orden de la página. Cada sección se lleva su propio contenido y sus propios
 * datos, así que acá no hay ni un texto ni un producto escrito a mano.
 */
export default function HomePage() {
  return (
    <main>
      <Hero />
      <ProductShowcase />
      <SoftwareWithoutRent />
      <FeaturedProduct />
      <HowItWorks />
      <Faq />
      <FinalCta />
    </main>
  );
}
