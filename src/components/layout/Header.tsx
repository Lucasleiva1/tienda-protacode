import Image from "next/image";
import Link from "next/link";
import { CartLink } from "@/components/cart/CartLink";
import { MobileNav } from "@/components/layout/MobileNav";
import { siteConfig } from "@/config/site";
import { getCurrentCustomerProfile } from "@/features/accounts/customer-session";

/**
 * Navegación global.
 *
 * Va fija arriba y con fondo sólido en vez de traslúcido con desenfoque: el borde
 * superior de la portada ya es casi negro, así que el header se funde con la imagen
 * sin recurrir al vidrio esmerilado de cualquier SaaS. Además es legible siempre,
 * sobre cualquier sección, y no cuesta nada de rendimiento.
 */
export async function Header() {
  const customer = await getCurrentCustomerProfile();
  const accountItem = {
    label: customer === null ? "Ingresar" : "Mi cuenta",
    href: customer === null ? "/cuenta/iniciar-sesion" : "/cuenta",
  };
  const mobileItems = [...siteConfig.navigation, accountItem];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-6 px-4 sm:px-6 lg:px-10">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-3"
          aria-label={`${siteConfig.name} — ir al inicio`}
        >
          <Image
            src={siteConfig.logo.src}
            alt=""
            width={siteConfig.logo.width}
            height={siteConfig.logo.height}
            priority
            sizes="40px"
            className="h-8 w-auto transition-transform duration-300 group-hover:-translate-y-0.5"
          />
          <span
            aria-hidden="true"
            className="hidden text-[0.9rem] font-semibold uppercase tracking-[0.14em] sm:inline"
          >
            Prota<span className="text-accent-contrast">code</span>
          </span>
        </Link>

        <nav aria-label="Principal" className="ml-auto hidden md:block">
          <ul className="flex items-center gap-1">
            {siteConfig.navigation.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group relative block px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
                >
                  {item.label}
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-3 bottom-1 h-px origin-left scale-x-0 bg-accent-contrast transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <Link
            href={accountItem.href}
            className="hidden border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:border-accent hover:text-foreground sm:block"
          >
            {accountItem.label}
          </Link>
          <CartLink />

          <MobileNav items={mobileItems} />
        </div>
      </div>
    </header>
  );
}
