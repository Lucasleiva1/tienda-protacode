import Link from "next/link";
import { requireAdminPage } from "@/features/admin/guard";
import { getPaymentRepository } from "@/features/payments/persistent-payment-repository";
import {
  getPaymentConfiguration,
  getPaymentGateway,
} from "@/lib/payments/gateway-registry";
import { getKeyValueStore, isNetlifyRuntime, STORES } from "@/lib/storage/store";
import { getLicenseConfiguration, getLicenseProvider } from "@/lib/licensing";
import { getPrivateDownloadStorage } from "@/lib/downloads/download-storage";
import { getWhatsAppConfiguration } from "@/features/checkout/whatsapp";
import { WhatsAppSettingsForm } from "@/components/admin/WhatsAppSettingsForm";
import { getEmailConfiguration } from "@/lib/email/verification-email";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración" };

/**
 * Estado del sistema.
 *
 * Solo informa. No muestra ni una clave, ni un secreto, ni una credencial: si algo
 * está configurado, dice "configurado", nunca su valor.
 */
export default async function AdminConfiguracionPage() {
  await requireAdminPage();

  const almacen = getKeyValueStore(STORES.products);
  const cobros = getPaymentGateway();
  const payment = getPaymentConfiguration();
  const paymentRepository = getPaymentRepository();
  const licensing = getLicenseConfiguration();
  const licenseProvider = getLicenseProvider();
  const downloads = getPrivateDownloadStorage();
  const whatsapp = await getWhatsAppConfiguration();
  const email = getEmailConfiguration();

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 py-10 sm:px-6">
      <h1 className="display text-4xl">Configuración</h1>

      <div className="mt-8 space-y-4">
        <Panel titulo="Tienda">
          <Fila etiqueta="Nombre" valor="Prota Code" />
          <Fila
            etiqueta="Entorno"
            valor={isNetlifyRuntime() ? "Netlify (publicado)" : "Local (desarrollo)"}
          />
        </Panel>

        <Panel titulo="Almacenamiento">
          <Fila etiqueta="Motor" valor={almacen.engine} />
          <Fila etiqueta="Productos" valor={STORES.products} />
          <Fila etiqueta="Configuración" valor={STORES.settings} />
          <Fila etiqueta="Clientes" valor={STORES.customers} />
          <Fila etiqueta="Verificaciones de email" valor={STORES.customerVerifications} />
          <Fila etiqueta="Límites de intentos" valor={STORES.rateLimits} />
          <Fila etiqueta="Pedidos" valor={STORES.orders} />
          <Fila etiqueta="Pagos" valor={STORES.payments} />
          <Fila etiqueta="Fulfillment" valor={STORES.fulfillment} />
          <Fila etiqueta="Accesos de compra" valor={STORES.purchaseAccess} />
          <Fila etiqueta="Downloads metadata" valor={STORES.productDownloads} />
          <Fila etiqueta="Downloads privados" valor={`${STORES.downloads} · ${downloads.engine}`} />
          <Fila etiqueta="Imágenes" valor={STORES.media} />
        </Panel>

        <Panel titulo="Medio de pago">
          <Fila etiqueta="Payment provider" valor={payment.label} />
          <Fila
            etiqueta="Payment status"
            valor={payment.ready ? "Ready" : "Not configured"}
          />
          <Fila etiqueta="Implementación activa" valor={cobros.name} />
          <Fila etiqueta="Persistencia" valor={paymentRepository.name} />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {payment.message} No se muestran tokens, firmas ni secretos en este panel.
          </p>
        </Panel>

        <Panel titulo="Email de cuentas">
          <Fila etiqueta="Confirmación por email" valor={email.ready ? "Configurada" : "No configurada"} />
          <Fila etiqueta="Servidor SMTP" valor={email.host === null ? "No configurado" : "Configurado"} />
          <Fila etiqueta="Remitente" valor={email.from === null ? "No configurado" : "Configurado"} />
          <Fila etiqueta="URL pública" valor={email.origin === null ? "No configurada" : "Configurada"} />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Las claves SMTP no se muestran ni se guardan en el navegador.
          </p>
        </Panel>

        <Panel titulo="Canal de venta">
          <Fila
            etiqueta="Canal solicitado"
            valor={whatsapp.requested ? "WhatsApp" : "Pago en línea"}
          />
          <Fila
            etiqueta="WhatsApp"
            valor={whatsapp.ready ? "Configurado" : "No configurado"}
          />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {whatsapp.message}
          </p>
          {whatsapp.number !== null ? (
            <WhatsAppSettingsForm number={whatsapp.number} />
          ) : null}
        </Panel>

        <Panel titulo="Licencias">
          <Fila etiqueta="Proveedor solicitado" valor={licensing.requestedProvider} />
          <Fila etiqueta="Proveedor activo" valor={licensing.activeProvider ?? "Ninguno"} />
          <Fila etiqueta="Estado" valor={licensing.ready ? "Ready" : "Not configured"} />
          <Fila etiqueta="Implementación" valor={licenseProvider.name} />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {licensing.message} Las credenciales server-to-server nunca se muestran aquí.
          </p>
        </Panel>

        <Panel titulo="Respaldos">
          <div className="mt-1 flex flex-wrap gap-2">
            <Link
              href="/api/admin/backup/productos"
              className="border border-border px-4 py-2 text-xs uppercase tracking-wider text-foreground transition-colors hover:border-accent"
            >
              Exportar productos
            </Link>
            <Link
              href="/api/admin/backup/pedidos"
              className="border border-border px-4 py-2 text-xs uppercase tracking-wider text-foreground transition-colors hover:border-accent"
            >
              Exportar pedidos
            </Link>
          </div>
        </Panel>
      </div>
    </main>
  );
}

function Panel({
  titulo,
  children,
}: {
  readonly titulo: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-surface p-5">
      <h2 className="eyebrow text-accent-contrast">{titulo}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Fila({ etiqueta, valor }: { readonly etiqueta: string; readonly valor: string }) {
  return (
    <div className="grid gap-1 border-b border-border py-2.5 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:items-baseline sm:gap-3">
      <dt className="eyebrow">{etiqueta}</dt>
      <dd className="min-w-0 break-all text-sm sm:text-right">{valor}</dd>
    </div>
  );
}
