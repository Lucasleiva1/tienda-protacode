import { PaymentMethodForm } from "@/components/admin/PaymentMethodForm";
import { WhatsAppSettingsForm } from "@/components/admin/WhatsAppSettingsForm";
import { requireAdminPage } from "@/features/admin/guard";
import { getWhatsAppNumber } from "@/features/checkout/whatsapp";
import { getPaymentMethodSettings } from "@/features/settings/payment-method-settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Medios de pago" };

/**
 * Medios de pago manuales.
 *
 * Lo que se carga acá lo ve el comprador al elegir cómo pagar. Son datos públicos
 * de cobro (alias, CVU, QR): nunca contraseñas ni claves de las billeteras.
 */
export default async function AdminPaymentMethodsPage() {
  await requireAdminPage("/admin/medios-de-pago");
  const [methods, whatsappNumber] = await Promise.all([
    getPaymentMethodSettings(),
    getWhatsAppNumber(),
  ]);

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="display text-4xl">Medios de pago</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Activá los medios que aceptás y cargá sus datos. Un medio de transferencia necesita al menos alias, CVU o
        QR para poder activarse. El cliente informa el pago con «Ya pagué» y vos lo confirmás desde Pedidos.
      </p>

      <div className="mt-6 space-y-4">
        {methods.map((method) => (
          <PaymentMethodForm key={method.id} method={method} />
        ))}
      </div>

      <section className="mt-6 border border-border bg-surface p-4 sm:p-5">
        <h2 className="eyebrow text-accent-contrast">Número de WhatsApp</h2>
        <p className="mt-2 text-xs leading-relaxed text-muted">
          Se usa en el medio WhatsApp y en el botón «Pagar / consultar por WhatsApp».
        </p>
        <WhatsAppSettingsForm number={whatsappNumber} />
      </section>
    </main>
  );
}
