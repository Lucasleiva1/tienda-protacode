import Image from "next/image";
import Link from "next/link";
import { CartLink } from "@/components/cart/CartLink";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { MobileNav } from "@/components/layout/MobileNav";
import { LanguageSelector } from "@/i18n/LanguageSelector";
import { navigationLabel, pick, type Locale } from "@/i18n/shared";
import { siteConfig } from "@/config/site";
import { getCurrentCustomerProfile } from "@/features/accounts/customer-session";
import { getPublishedProducts } from "@/features/products/queries";

export async function Header({ locale }: { readonly locale: Locale }) {
  const customer = await getCurrentCustomerProfile();
  // El carrito guarda solo slugs: el panel necesita el catálogo de hoy para
  // mostrar nombre y precio actuales.
  const catalogo = await getPublishedProducts();
  const navigation = siteConfig.navigation.map((item) => ({
    ...item,
    label: navigationLabel(locale, item.label),
  }));
  const accountItems =
    customer === null
      ? [{ label: pick(locale, "Ingresar", "Sign in", "Entrar"), href: "/cuenta/iniciar-sesion" }]
      : [
          { label: pick(locale, "Mi cuenta", "My account", "Minha conta"), href: "/cuenta" },
          { label: pick(locale, "Mis compras", "My purchases", "Minhas compras"), href: "/cuenta/compras" },
        ];
  const mobileItems = [...navigation, ...accountItems];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background">
      <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center gap-6 px-4 sm:px-6 lg:px-10">
        <Link
          href="/"
          className="group flex shrink-0 items-center gap-3"
          aria-label={siteConfig.name + " — " + pick(locale, "ir al inicio", "go to home", "ir para o início")}
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

        <nav aria-label={pick(locale, "Principal", "Main", "Principal")} className="ml-auto hidden md:block">
          <ul className="flex items-center gap-1">
            {navigation.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="group relative block px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
                >
                  {item.label}
                  <span aria-hidden="true" className="absolute inset-x-3 bottom-1 h-px origin-left scale-x-0 bg-accent-contrast transition-transform duration-300 ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          {customer === null ? (
            <Link
              href="/cuenta/iniciar-sesion"
              className="hidden border border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted transition-colors hover:border-accent hover:text-foreground sm:block"
            >
              {pick(locale, "Ingresar", "Sign in", "Entrar")}
            </Link>
          ) : (
            <AccountMenu firstName={customer.firstName} avatarUrl={customer.avatarUrl} locale={locale} />
          )}
          <CartLink
            locale={locale}
            catalog={catalogo}
            currency={siteConfig.defaultCurrency}
          />
          <LanguageSelector locale={locale} />
          <MobileNav
            items={mobileItems}
            locale={locale}
            greeting={customer === null ? null : `${pick(locale, "Hola, ", "Hi, ", "Olá, ")}${customer.firstName}`}
          />
        </div>
      </div>
    </header>
  );
}
