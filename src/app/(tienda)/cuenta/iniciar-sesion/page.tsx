import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { CustomerAuthForm } from "@/components/account/CustomerAuthForm";
import { safeNextPath } from "@/features/accounts/auth-utils";
import { getCurrentCustomerProfile } from "@/features/accounts/customer-session";
import { getGoogleAuthConfiguration } from "@/features/accounts/google-auth";

export const metadata = { title: "Iniciar sesión", robots: { index: false } };

export default async function LoginPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  if ((await getCurrentCustomerProfile()) !== null) redirect(next);
  const google = getGoogleAuthConfiguration();

  return (
    <AccountShell eyebrow="Cuenta de cliente" title="Iniciar sesión">
      <CustomerAuthForm
        mode="login"
        next={next}
        googleReady={google.ready}
        googleError={typeof params.error === "string" ? params.error : undefined}
      />
    </AccountShell>
  );
}
