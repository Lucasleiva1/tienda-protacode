import { AccountShell } from "@/components/account/AccountShell";
import { ConfirmEmailForm } from "@/components/account/EmailVerificationActions";

export const metadata = { title: "Confirmar email", robots: { index: false } };

export default async function ConfirmEmailPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <AccountShell eyebrow="Cuenta de cliente" title="Confirmar email">
      {token ? (
        <ConfirmEmailForm token={token} />
      ) : (
        <p className="border border-danger/50 bg-danger/10 px-3 py-2 text-sm">
          El enlace está incompleto. Volvé a solicitarlo desde tu cuenta.
        </p>
      )}
    </AccountShell>
  );
}
