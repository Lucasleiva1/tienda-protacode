import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { CustomerAuthForm } from "@/components/account/CustomerAuthForm";
import { safeNextPath } from "@/features/accounts/auth-utils";
import { getCurrentCustomerProfile } from "@/features/accounts/customer-session";
import { getGoogleAuthConfiguration } from "@/features/accounts/google-auth";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: pick(locale, "Iniciar sesión", "Sign in", "Entrar"), robots: { index: false } };
}

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  if ((await getCurrentCustomerProfile()) !== null) redirect(next);
  const google = getGoogleAuthConfiguration();

  return (
    <AccountShell
      locale={locale}
      eyebrow={pick(locale, "Cuenta de cliente", "Customer account", "Conta de cliente")}
      title={pick(locale, "Iniciar sesión", "Sign in", "Entrar")}
    >
      <CustomerAuthForm
        mode="login"
        next={next}
        googleReady={google.ready}
        googleError={typeof params.error === "string" ? params.error : undefined}
        locale={locale}
      />
    </AccountShell>
  );
}
