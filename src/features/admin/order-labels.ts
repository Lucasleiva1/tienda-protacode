import type { LicenseDeliveryState, OrderStage } from "@/features/payments/manual-payment-state";
import type { ManualPaymentStatus } from "@/types/manual-payment";
import type { FulfillmentStatus } from "@/types/order";

/** Textos del panel para los estados del pedido. */

export const ADMIN_STAGE_LABEL: Record<OrderStage, string> = {
  pending: "Sin medio elegido",
  awaiting_payment: "Esperando pago",
  awaiting_verification: "Por verificar",
  paid: "Pagado · entrega pendiente",
  completed: "Completado",
  rejected: "Rechazado",
  cancelled: "Cancelado",
};

export const ADMIN_MANUAL_PAYMENT_LABEL: Record<ManualPaymentStatus, string> = {
  pending: "Pendiente",
  awaiting_verification: "Informado · por verificar",
  paid: "Pagado",
  rejected: "Rechazado",
};

export const ADMIN_LICENSE_LABEL: Record<LicenseDeliveryState, string> = {
  pending: "Pendiente",
  assigning: "Asignando",
  assigned: "Asignada",
  failed: "Falló · reintentar",
  not_required: "No requiere",
};

export const ADMIN_FULFILLMENT_LABEL: Record<FulfillmentStatus, string> = {
  not_started: "Sin iniciar",
  pending: "Procesando",
  partial: "Parcial",
  failed: "Requiere reintento",
  fulfilled: "Completado",
};
