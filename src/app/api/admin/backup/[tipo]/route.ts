import { isAdmin } from "@/features/admin/guard";
import { findAllOrders } from "@/features/orders/persistent-order-repository";
import { getProducts } from "@/features/products/queries";
import type { Order } from "@/types/order";

function standardOrderBackup(order: Order) {
  const manual = order.manualPayment;
  return {
    id: order.id,
    reference: order.reference,
    status: order.status,
    customer: order.customer,
    items: order.items.map((item) => ({
      productId: item.productId,
      slug: item.slug,
      appId: item.appId,
      name: item.name,
      version: item.version,
      platforms: item.platforms,
      downloadType: item.downloadType,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      licenseRequired: item.licenseRequired,
      licenseStatus: item.licenseStatus,
      issuedAt: item.issuedAt,
      licenseError: item.licenseError,
      downloadReady: item.downloadFile !== null,
      downloadFileName: item.downloadFile?.fileName ?? null,
      downloadEnabledAt: item.downloadEnabledAt,
    })),
    currency: order.currency,
    subtotal: order.subtotal,
    total: order.total,
    payment: order.payment,
    // El comprobante se informa solo como metadato: su clave interna no se exporta.
    manualPayment:
      manual === null
        ? null
        : {
            ...manual,
            proof:
              manual.proof === null
                ? null
                : {
                    contentType: manual.proof.contentType,
                    size: manual.proof.size,
                    uploadedAt: manual.proof.uploadedAt,
                  },
          },
    licenseStatus: order.licenseStatus,
    fulfillment: order.fulfillment,
    notifications: order.notifications,
    purchaseAccessConfigured: order.purchaseAccess !== null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

/**
 * Respaldo en JSON de productos o pedidos.
 *
 * Exige sesión: los pedidos traen nombres y emails de clientes y no pueden quedar
 * al alcance de cualquiera que adivine la dirección.
 *
 * Solo salen datos del negocio. Nunca secretos: ni el hash de la contraseña, ni el
 * secreto de sesión, ni credenciales de ningún proveedor.
 */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/admin/backup/[tipo]">,
) {
  if (!(await isAdmin())) {
    return new Response("No autorizado", { status: 401 });
  }

  const { tipo } = await params;

  if (tipo !== "productos" && tipo !== "pedidos") {
    return new Response("Tipo no válido", { status: 404 });
  }

  const datos =
    tipo === "productos"
      ? await getProducts()
      : (await findAllOrders()).map(standardOrderBackup);

  const fecha = new Date().toISOString().slice(0, 10);
  const cuerpo = JSON.stringify(
    { tipo, exportadoEl: new Date().toISOString(), total: datos.length, datos },
    null,
    2,
  );

  return new Response(cuerpo, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="prota-code-${tipo}-${fecha}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
