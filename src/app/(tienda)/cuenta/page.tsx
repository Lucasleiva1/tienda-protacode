import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { logoutCustomerAction } from "@/features/accounts/auth-actions";
import { getCurrentCustomerProfile } from "@/features/accounts/customer-session";
import { ResendVerificationButton } from "@/components/account/EmailVerificationActions";
import { safeNextPath } from "@/features/accounts/auth-utils";
import { getLocale } from "@/i18n/server";
import { pick, type Locale } from "@/i18n/shared";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: pick(locale, "Mi cuenta", "My account", "Minha conta"), robots: { index: false } };
}

export default async function AccountPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const customer = await getCurrentCustomerProfile();
  if (customer === null) redirect("/cuenta/iniciar-sesion");
  const verification = typeof params.verificacion === "string" ? params.verificacion : null;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  return (
    <AccountShell
      locale={locale}
      eyebrow={pick(locale, "Cuenta de cliente", "Customer account", "Conta de cliente")}
      title={pick(locale, "Hola, ", "Hi, ", "Olá, ") + customer.firstName}
    >
      {verification !== null ? (
        <VerificationNotice status={verification} next={next} locale={locale} />
      ) : null}
      <dl className="border-t border-border">
        <Row label={pick(locale, "Nombre", "Name", "Nome")} value={`${customer.firstName} ${customer.lastName}`} />
        <Row label={pick(locale, "Email", "Email", "E-mail")} value={customer.email} />
        <Row label={pick(locale, "Estado del email", "Email status", "Status do e-mail")} value={customer.emailVerified ? pick(locale, "Confirmado", "Confirmed", "Confirmado") : pick(locale, "Pendiente", "Pending", "Pendente")} />
        <Row label={pick(locale, "Ingreso con Google", "Google sign-in", "Login com Google")} value={customer.hasGoogle ? pick(locale, "Vinculado", "Linked", "Vinculado") : pick(locale, "No vinculado", "Not linked", "Não vinculado")} />
        <Row label={pick(locale, "Contraseña", "Password", "Senha")} value={customer.hasPassword ? pick(locale, "Configurada", "Set", "Configurada") : pick(locale, "Ingreso con Google", "Google sign-in", "Login com Google")} />
      </dl>
      {!customer.emailVerified ? <ResendVerificationButton locale={locale} /> : null}
      <Link
        href="/cuenta/compras"
        className="mt-8 block w-full bg-accent px-6 py-3.5 text-center text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast"
      >
        {pick(locale, "Mis compras", "My purchases", "Minhas compras")}
      </Link>
      <form action={logoutCustomerAction} className="mt-8">
        <button className="border border-border px-5 py-3 text-sm font-semibold uppercase tracking-wider hover:border-accent">
          {pick(locale, "Cerrar sesión", "Sign out", "Sair")}
        </button>
        <p className="mt-2 text-xs text-muted">
          {pick(locale, "Cierra la sesión en todos tus dispositivos.", "Signs you out on all your devices.", "Encerra a sessão em todos os seus dispositivos.")}
        </p>
      </form>
    </AccountShell>
  );
}

function VerificationNotice({
  status,
  next,
  locale,
}: {
  readonly status: string;
  readonly next: string;
  readonly locale: Locale;
}) {
  const messages: Record<string, string> = {
    enviada: pick(locale, "Te enviamos el enlace de confirmación. Revisá también correo no deseado.", "We sent you the confirmation link. Check your spam folder too.", "Enviamos o link de confirmação. Verifique também a caixa de spam."),
    "no-enviada": pick(locale, "La cuenta fue creada, pero el envío de email todavía no está configurado.", "Your account was created, but email sending is not configured yet.", "A conta foi criada, mas o envio de e-mails ainda não está configurado."),
    requerida: pick(locale, "Confirmá tu email antes de continuar con la compra.", "Confirm your email before continuing with your purchase.", "Confirme seu e-mail antes de continuar com a compra."),
    confirmada: pick(locale, "Tu email quedó confirmado. Ya podés comprar.", "Your email is confirmed. You can now buy.", "Seu e-mail foi confirmado. Você já pode comprar."),
  };
  const message = messages[status];
  if (message === undefined) return null;
  return (
    <p className="mb-6 border border-accent/50 bg-accent/10 px-4 py-3 text-sm">
      {message}{status === "confirmada" && next === "/checkout" ? pick(locale, " Volvé al carrito para continuar.", " Go back to your cart to continue.", " Volte ao carrinho para continuar.") : ""}
    </p>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="grid gap-1 border-b border-border py-4 sm:grid-cols-2 sm:items-baseline">
      <dt className="eyebrow">{label}</dt>
      <dd className="break-all text-sm sm:text-right">{value}</dd>
    </div>
  );
}
