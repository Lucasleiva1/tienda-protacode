import { AccountShell } from "@/components/account/AccountShell";
import { ConfirmEmailForm } from "@/components/account/EmailVerificationActions";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: pick(locale, "Confirmar email", "Confirm email", "Confirmar e-mail"), robots: { index: false } };
}

export default async function ConfirmEmailPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <AccountShell
      locale={locale}
      eyebrow={pick(locale, "Cuenta de cliente", "Customer account", "Conta de cliente")}
      title={pick(locale, "Confirmar email", "Confirm email", "Confirmar e-mail")}
    >
      {token ? (
        <ConfirmEmailForm token={token} locale={locale} />
      ) : (
        <p className="border border-danger/50 bg-danger/10 px-3 py-2 text-sm">
          {pick(
            locale,
            "El enlace está incompleto. Volvé a solicitarlo desde tu cuenta.",
            "The link is incomplete. Request it again from your account.",
            "O link está incompleto. Solicite-o novamente pela sua conta.",
          )}
        </p>
      )}
    </AccountShell>
  );
}
