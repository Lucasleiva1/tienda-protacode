import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { hasValidSession } from "@/features/admin/session";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Con sesión abierta no tiene sentido mostrar el login.
  if (await hasValidSession()) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="eyebrow text-accent-contrast">Prota Code</p>
        <h1 className="display mt-3 text-4xl">Panel</h1>
        <p className="mt-3 text-sm text-muted">
          Entrá para administrar los programas y ver los pedidos.
        </p>

        <div className="mt-8 border border-border bg-surface">
          <div aria-hidden="true" className="h-px bg-accent/70" />
          <div className="p-6">
            <LoginForm />
          </div>
        </div>
      </div>
    </main>
  );
}
