import type { Metadata } from "next";
import { AccountShell } from "@/components/account/AccountShell";
import { RecoveryForm } from "@/components/purchases/RecoveryForm";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: pick(locale, "Recuperar mi compra", "Recover my purchase", "Recuperar minha compra"),
    robots: { index: false, follow: false },
  };
}

export default async function RecoverPurchasePage() {
  const locale = await getLocale();
  return (
    <AccountShell
      locale={locale}
      eyebrow={pick(locale, "Compras como invitado", "Guest purchases", "Compras como convidado")}
      title={pick(locale, "Recuperar mi compra", "Recover my purchase", "Recuperar minha compra")}
    >
      <p className="mb-6 text-sm leading-relaxed text-muted">
        {pick(
          locale,
          "Escribí el email que usaste al comprar y el número de pedido (por ejemplo PC-1051). Te enviamos un enlace privado nuevo.",
          "Enter the email you used to buy and the order number (for example PC-1051). We will send you a new private link.",
          "Digite o e-mail usado na compra e o número do pedido (por exemplo PC-1051). Enviaremos um novo link privado.",
        )}
      </p>
      <RecoveryForm locale={locale} />
    </AccountShell>
  );
}
