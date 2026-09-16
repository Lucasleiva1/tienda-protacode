import { ProductCard } from "@/components/products/ProductCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { getPublishedProducts } from "@/features/products/queries";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

export async function ProductShowcase() {
  const [products, locale] = await Promise.all([getPublishedProducts(), getLocale()]);
  return (
    <section
      id="programas"
      aria-labelledby="programas-titulo"
      className="scroll-mt-20 border-t border-border"
    >
      <div className="mx-auto w-full max-w-[1400px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionHeading
          index="01"
          label={pick(locale, "Programas", "Programs", "Programas")}
          id="programas-titulo"
          title={pick(locale, "Herramientas para problemas concretos.", "Tools for real problems.", "Ferramentas para problemas concretos.")}
        >
          {pick(
            locale,
            "Cada programa resuelve una cosa y la resuelve bien. Se compra una vez y se usa la versión adquirida.",
            "Each program solves a specific problem and does it well. Buy it once and use the version you purchased.", "Cada programa resolve uma coisa e resolve bem. Você compra uma vez e usa a versão adquirida.",
          )}
        </SectionHeading>
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {products.map((product, index) => (
            <li key={product.id} className="min-w-0">
              <ProductCard product={product} index={index} locale={locale} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
