import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account/AccountShell";
import { logoutCustomerAction } from "@/features/accounts/auth-actions";
import { getCurrentCustomerProfile } from "@/features/accounts/customer-session";
import { ResendVerificationButton } from "@/components/account/EmailVerificationActions";
import { safeNextPath } from "@/features/accounts/auth-utils";

export const metadata = { title: "Mi cuenta", robots: { index: false } };

export default async function AccountPage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const customer = await getCurrentCustomerProfile();
  if (customer === null) redirect("/cuenta/iniciar-sesion");
  const verification = typeof params.verificacion === "string" ? params.verificacion : null;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);

  return (
    <AccountShell eyebrow="Cuenta de cliente" title={`Hola, ${customer.firstName}`}>
      {verification !== null ? (
        <VerificationNotice status={verification} next={next} />
      ) : null}
      <dl className="border-t border-border">
        <Row label="Nombre" value={`${customer.firstName} ${customer.lastName}`} />
        <Row label="Email" value={customer.email} />
        <Row label="Estado del email" value={customer.emailVerified ? "Confirmado" : "Pendiente"} />
        <Row label="Ingreso con Google" value={customer.hasGoogle ? "Vinculado" : "No vinculado"} />
        <Row label="Contraseña" value={customer.hasPassword ? "Configurada" : "Ingreso con Google"} />
      </dl>
      {!customer.emailVerified ? <ResendVerificationButton /> : null}
      <form action={logoutCustomerAction} className="mt-8">
        <button className="border border-border px-5 py-3 text-sm font-semibold uppercase tracking-wider hover:border-accent">
          Cerrar sesión
        </button>
      </form>
    </AccountShell>
  );
}

function VerificationNotice({ status, next }: { readonly status: string; readonly next: string }) {
  const messages: Record<string, string> = {
    enviada: "Te enviamos el enlace de confirmación. Revisá también correo no deseado.",
    "no-enviada": "La cuenta fue creada, pero el envío de email todavía no está configurado.",
    requerida: "Confirmá tu email antes de continuar con la compra.",
    confirmada: "Tu email quedó confirmado. Ya podés comprar.",
  };
  const message = messages[status];
  if (message === undefined) return null;
  return (
    <p className="mb-6 border border-accent/50 bg-accent/10 px-4 py-3 text-sm">
      {message}{status === "confirmada" && next === "/checkout" ? " Volvé al carrito para continuar." : ""}
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
