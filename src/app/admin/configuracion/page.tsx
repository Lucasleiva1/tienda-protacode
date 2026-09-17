import Link from "next/link";
import { getGoogleAuthConfiguration } from "@/features/accounts/google-auth";
import { getGoogleClientId } from "@/features/accounts/google-identity";
import { requireAdminPage } from "@/features/admin/guard";
import { createLicenseService } from "@/features/licensing/license-service";
import { getPushSubscriptionRepository } from "@/features/notifications/push-subscription-repository";
import { getPaymentRepository } from "@/features/payments/persistent-payment-repository";
import {
  getPaymentMethodSettings,
  isPaymentMethodUsable,
} from "@/features/settings/payment-method-settings";
import { getPrivateDownloadStorage } from "@/lib/downloads/download-storage";
import { getEmailConfiguration } from "@/lib/email/mailer";
import {
  getPaymentConfiguration,
  getPaymentGateway,
} from "@/lib/payments/gateway-registry";
import { getPushConfiguration } from "@/lib/push/web-push-sender";
import { getKeyValueStore, isNetlifyRuntime, STORES } from "@/lib/storage/store";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configuración" };

/**
 * Estado del sistema.
 *
 * Solo informa. No muestra ni una clave, ni un secreto, ni una credencial: si algo
 * está configurado, dice "configurado", nunca su valor.
 */
export default async function AdminConfiguracionPage() {
  await requireAdminPage("/admin/configuracion");

  const almacen = getKeyValueStore(STORES.products);
  const cobros = getPaymentGateway();
  const payment = getPaymentConfiguration();
  const paymentRepository = getPaymentRepository();
  const licencias = createLicenseService().summary();
  const downloads = getPrivateDownloadStorage();
  const email = getEmailConfiguration();
  const push = getPushConfiguration();
  const googlePopup = getGoogleClientId() !== null;
  const googleRedirect = getGoogleAuthConfiguration().ready;
  const [metodos, dispositivos] = await Promise.all([
    getPaymentMethodSettings(),
    push.ready ? getPushSubscriptionRepository().list() : Promise.resolve([]),
  ]);
  const activos = metodos.filter(isPaymentMethodUsable);

  return (
    <main className="mx-auto w-full max-w-[900px] px-4 py-6 sm:px-6 sm:py-10">
      <h1 className="display text-4xl">Configuración</h1>

      <div className="mt-8 space-y-4">
        <Panel titulo="Tienda">
          <Fila etiqueta="Nombre" valor="Prota Code" />
          <Fila
            etiqueta="Entorno"
            valor={isNetlifyRuntime() ? "Netlify (publicado)" : "Local (desarrollo)"}
          />
        </Panel>

        <Panel titulo="Pagos manuales">
          <Fila etiqueta="Medios activos" valor={activos.length === 0 ? "Ninguno" : activos.map((m) => m.name).join(", ")} />
          <Fila etiqueta="Confirmación" valor="Manual desde Pedidos (solo Admin)" />
          <Link
            href="/admin/medios-de-pago"
            className="mt-3 inline-block border border-border px-4 py-2 text-xs uppercase tracking-wider text-foreground transition-colors hover:border-accent"
          >
            Editar medios de pago
          </Link>
        </Panel>

        <Panel titulo="Pasarela automática">
          <Fila etiqueta="Payment provider" valor={payment.label} />
          <Fila
            etiqueta="Payment status"
            valor={payment.ready ? "Ready" : "Not configured"}
          />
          <Fila etiqueta="Implementación activa" valor={cobros.name} />
          <Fila etiqueta="Persistencia" valor={paymentRepository.name} />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {payment.message} Mientras no haya pasarela, los pedidos usan pagos manuales.
          </p>
        </Panel>

        <Panel titulo="Notificaciones push">
          <Fila etiqueta="Claves VAPID" valor={push.ready ? "Configuradas" : "No configuradas"} />
          <Fila etiqueta="Dispositivos activos" valor={String(dispositivos.length)} />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {push.ready
              ? "Activalas en cada celular desde el Resumen del panel."
              : "Generá las claves con «npm run push:claves» y cargalas en Netlify."}
          </p>
        </Panel>

        <Panel titulo="Ingreso de clientes con Google">
          <Fila etiqueta="Botón (ventana emergente)" valor={googlePopup ? "Configurado" : "Falta GOOGLE_CLIENT_ID"} />
          <Fila etiqueta="Alternativa por redirección" valor={googleRedirect ? "Configurada" : "No configurada (opcional)"} />
          <Fila etiqueta="Permisos pedidos" valor="openid, email, profile" />
        </Panel>

        <Panel titulo="Email">
          <Fila
            etiqueta="Envío"
            valor={email.localOutbox ? "Bandeja local (.data/outbox)" : email.ready ? "SMTP configurado" : "No configurado"}
          />
          <Fila etiqueta="Servidor SMTP" valor={email.host === null ? "No configurado" : "Configurado"} />
          <Fila etiqueta="Remitente" valor={email.from === null ? "No configurado" : "Configurado"} />
          <Fila etiqueta="URL pública" valor={email.origin === null ? "No configurada" : "Configurada"} />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Se usa para confirmar cuentas y para enviar el enlace del pedido, el pago aprobado y la licencia. Las
            claves SMTP no se muestran.
          </p>
        </Panel>

        <Panel titulo="Licencias">
          <Fila etiqueta="Proveedor solicitado" valor={licencias.requestedProvider} />
          <Fila etiqueta="Proveedor activo" valor={licencias.activeProvider ?? "Ninguno"} />
          <Fila etiqueta="Estado" valor={licencias.ready ? "Ready" : "Not configured"} />
          <Fila etiqueta="Implementación" valor={licencias.implementation} />
          <Fila etiqueta="Consulta y validación" valor={licencias.canLookup ? "Disponible" : "No disponible en este proveedor"} />
          <p className="mt-3 text-xs leading-relaxed text-muted">
            {licencias.message} Las credenciales server-to-server nunca se muestran aquí.
          </p>
        </Panel>

        <Panel titulo="Almacenamiento">
          <Fila etiqueta="Motor" valor={almacen.engine} />
          <Fila etiqueta="Productos" valor={STORES.products} />
          <Fila etiqueta="Configuración" valor={STORES.settings} />
          <Fila etiqueta="Clientes" valor={STORES.customers} />
          <Fila etiqueta="Verificaciones de email" valor={STORES.customerVerifications} />
          <Fila etiqueta="Límites de intentos" valor={STORES.rateLimits} />
          <Fila etiqueta="Pedidos" valor={STORES.orders} />
          <Fila etiqueta="Números de pedido" valor={STORES.orderReferences} />
          <Fila etiqueta="Pagos" valor={STORES.payments} />
          <Fila etiqueta="Comprobantes (privado)" valor={STORES.paymentProofs} />
          <Fila etiqueta="Fulfillment" valor={STORES.fulfillment} />
          <Fila etiqueta="Accesos de compra" valor={STORES.purchaseAccess} />
          <Fila etiqueta="Dispositivos push" valor={STORES.pushSubscriptions} />
          <Fila etiqueta="Downloads metadata" valor={STORES.productDownloads} />
          <Fila etiqueta="Downloads privados" valor={`${STORES.downloads} · ${downloads.engine}`} />
          <Fila etiqueta="Imágenes" valor={STORES.media} />
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
