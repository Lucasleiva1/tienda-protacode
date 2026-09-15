import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/features/admin/login-actions";
import { hasValidSession } from "@/features/admin/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin Prota Code" },
  /* El panel no se indexa ni aparece en buscadores. */
  robots: { index: false, follow: false, nocache: true },
};

const SECCIONES = [
  { label: "Resumen", href: "/admin" },
  { label: "Programas", href: "/admin/programas" },
  { label: "Pedidos", href: "/admin/pedidos" },
  { label: "Configuración", href: "/admin/configuracion" },
] as const;

/**
 * Envoltorio del panel.
 *
 * Mantiene la paleta y la tipografía de la marca, pero con otra densidad: barra
 * compacta, sin portada y sin footer de tienda. Es una herramienta de trabajo.
 *
 * La barra solo aparece con sesión abierta. Igual, cada página vuelve a verificar
 * la sesión por su cuenta: esconder el menú no protege nada.
 */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const conSesion = await hasValidSession();

  return (
    <div className="min-h-dvh">
      {conSesion ? (
        <header className="sticky top-0 z-40 border-b border-border bg-surface">
          <div className="mx-auto flex w-full max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6 lg:h-14 lg:flex-nowrap lg:gap-6 lg:py-0">
            <Link
              href="/admin"
              className="shrink-0 text-sm font-semibold uppercase tracking-[0.14em]"
            >
              Prota<span className="text-accent-contrast">code</span>
              <span className="ml-2 text-muted">Admin</span>
            </Link>

            <nav aria-label="Panel" className="order-3 -mx-1 w-[calc(100%+0.5rem)] min-w-0 overflow-x-auto lg:order-none lg:mx-0 lg:w-auto lg:flex-1">
              <ul className="flex items-center gap-1">
                {SECCIONES.map((seccion) => (
                  <li key={seccion.href}>
                    <Link
                      href={seccion.href}
                      className="block whitespace-nowrap px-3 py-2 text-sm text-muted transition-colors hover:text-foreground"
                    >
                      {seccion.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/"
                className="hidden whitespace-nowrap border border-border px-3 py-1.5 text-xs uppercase tracking-wider text-muted transition-colors hover:text-foreground sm:block"
              >
                Ver tienda
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="whitespace-nowrap border border-border px-3 py-1.5 text-xs uppercase tracking-wider text-muted transition-colors hover:border-danger/60 hover:text-foreground"
                >
                  Salir
                </button>
              </form>
            </div>
          </div>
        </header>
      ) : null}

      {children}
    </div>
  );
}
