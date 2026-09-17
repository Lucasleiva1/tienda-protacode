import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { CustomerAuthForm } from "@/components/account/CustomerAuthForm";
import { safeNextPath } from "@/features/accounts/auth-utils";
import { getCurrentCustomerProfile } from "@/features/accounts/customer-session";
import { googleRedirectSignInHref } from "@/features/accounts/google-auth";
import { getGoogleClientId } from "@/features/accounts/google-identity";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: pick(locale, "Crear cuenta", "Create account", "Criar conta"), robots: { index: false } };
}

export default async function RegisterPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  if ((await getCurrentCustomerProfile()) !== null) redirect(next);

  return (
    <AccountShell
      locale={locale}
      eyebrow={pick(locale, "Cuenta de cliente", "Customer account", "Conta de cliente")}
      title={pick(locale, "Crear cuenta", "Create account", "Criar conta")}
    >
      <CustomerAuthForm
        mode="register"
        next={next}
        googleReady={getGoogleClientId() !== null}
        googleFallbackHref={googleRedirectSignInHref(next)}
        locale={locale}
      />
    </AccountShell>
  );
}
