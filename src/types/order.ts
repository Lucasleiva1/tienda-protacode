/**
 * Tipos de carrito y pedido.
 *
 * El pedido es el registro comercial de una compra. Se crea en el servidor y nunca
 * con datos que venga del navegador: ver `order-service.ts`.
 */

import type { DownloadFileReference } from "@/types/download";
import type { OrderManualPayment } from "@/types/manual-payment";
import type {
  Currency,
  DownloadType,
  Money,
  Platform,
} from "@/types/product";
import type { PaymentStatus } from "@/types/payment";

export type { PaymentStatus } from "@/types/payment";

/**
 * Estado del pedido.
 *
 * pending   → creado, esperando el pago
 * paid      → el pago fue confirmado por el proveedor
 * failed    → el pago fue rechazado
 * cancelled → se canceló antes de pagarse
 * fulfilled → pagado Y con la licencia entregada
 */
export type OrderStatus =
  | "pending"
  | "paid"
  | "failed"
  | "cancelled"
  | "fulfilled";

/**
 * Estado del cobro, separado del estado del pedido.
 *
 * Van separados porque no son lo mismo: un pago puede estar aprobado y el pedido
 * todavía no cumplido (falta entregar la licencia). Mezclarlos obligaría a inventar
 * estados combinados.
 *
 * `not_started` es el único que se usa hoy: todavía no hay proveedor de pagos.
 */
/**
 * Estado de la licencia.
 *
 * not_requested → todavía no se pidió (pago sin confirmar)
 * pending       → asignación en curso
 * issued        → asignada
 * failed        → la asignación falló y puede reintentarse sin tocar el pago
 * not_required  → el programa se entrega sin clave
 *
 * Una licencia solo puede pedirse DESPUÉS de un pago aprobado y verificado en el
 * servidor, nunca al crear el pedido.
 */
export type LicenseStatus =
  | "not_requested"
  | "pending"
  | "issued"
  | "failed"
  | "not_required";

export type FulfillmentStatus =
  | "not_started"
  | "pending"
  | "partial"
  | "failed"
  | "fulfilled";

export interface OrderFulfillment {
  readonly status: FulfillmentStatus;
  readonly lastAttemptAt: string | null;
  readonly completedAt: string | null;
  /** Código técnico controlado; nunca una clave ni un stack trace. */
  readonly lastError: string | null;
  /** Cuándo quedaron asignadas todas las licencias requeridas. */
  readonly licenseAssignedAt: string | null;
}

/**
 * Avisos por email ya enviados al comprador.
 *
 * Se marcan ANTES de enviar: un reintento de entrega nunca repite el mismo email.
 */
export interface OrderNotifications {
  readonly paymentApprovedEmailAt: string | null;
  readonly deliveryReadyEmailAt: string | null;
}

export interface PurchaseAccess {
  /** SHA-256 hexadecimal. El token opaco plano no se persiste. */
  readonly tokenHash: string;
  readonly createdAt: string;
  readonly rotatedAt: string | null;
  /**
   * Enlaces adicionales enviados por email (solo SHA-256). Conviven con el
   * principal para no invalidar la página que el comprador tiene abierta; rotar el
   * acceso los revoca a todos.
   */
  readonly extraTokenHashes: readonly string[];
}

/**
 * Ítem del carrito.
 *
 * Guarda solo referencias, no precios: mientras el carrito está abierto el precio
 * se resuelve contra el producto vigente. Recién al confirmar el pedido se congela.
 */
export interface CartItem {
  readonly productId: string;
  readonly slug: string;
  readonly appId: string;
  readonly quantity: number;
}

/**
 * Ítem ya comprado.
 *
 * Copia nombre, versión y precio del momento de la compra en vez de referenciar al
 * producto vivo. Motivo concreto del negocio: la licencia es permanente sobre la
 * versión comprada. Si mañana sube el precio o cambia el nombre, este pedido tiene
 * que seguir diciendo qué se vendió y a cuánto.
 *
 * `appId` viaja acá porque es lo que va a necesitar RXW-CORE para emitir la licencia
 * cuando el pago esté aprobado. No se muestra nunca al comprador.
 */
export interface OrderItem {
  readonly productId: string;
  readonly slug: string;
  readonly appId: string;
  readonly name: string;
  readonly version: string;
  readonly platforms: readonly Platform[];
  readonly downloadType: DownloadType;
  readonly unitPrice: Money;
  readonly quantity: number;
  /** Copia de `Product.licenseRequired` al momento de comprar. */
  readonly licenseRequired: boolean;
  readonly licenseStatus: LicenseStatus;
  readonly licenseKey: string | null;
  /** Identificador de la licencia en el sistema externo, si lo informa. */
  readonly licenseId: string | null;
  readonly issuedAt: string | null;
  /** Código controlado del proveedor; nunca contiene la clave. */
  readonly licenseError: string | null;
  /** Snapshot privado del binario autorizado para esta compra. */
  readonly downloadFile: DownloadFileReference | null;
  readonly downloadEnabledAt: string | null;
}

/** Datos del comprador. Lo mínimo para identificar la compra y entregarla. */
export interface OrderCustomer {
  /** Cuenta autenticada que originó la compra; ausente solo en pedidos históricos. */
  readonly accountId?: string | null;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  /** Solo dígitos, con código de país. Opcional. */
  readonly whatsapp?: string | null;
}

/**
 * Cobro del pedido.
 *
 * `provider` es `null` mientras no haya proveedor elegido. Cuando exista, guarda su
 * nombre y la referencia externa, sin que el resto del sistema tenga que saber cuál es.
 */
export interface OrderPayment {
  /** Referencia al modelo Payment separado. `null` antes de iniciar el cobro. */
  readonly paymentId: string | null;
  readonly status: PaymentStatus;
  readonly provider: string | null;
  readonly providerReference: string | null;
}

export interface Order {
  /**
   * UUID interno.
   *
   * No se reemplaza por la referencia legible: forma parte de las claves de
   * idempotencia que ya viajan al sistema de licencias.
   */
  readonly id: string;
  /** Referencia legible y única, por ejemplo `PC-1051`. `null` en pedidos viejos. */
  readonly reference: string | null;
  readonly status: OrderStatus;
  readonly customer: OrderCustomer;
  readonly items: readonly OrderItem[];
  /** Moneda del pedido. Un pedido tiene una sola. */
  readonly currency: Currency;
  readonly subtotal: Money;
  readonly total: Money;
  readonly payment: OrderPayment;
  /** Pago manual. `null` en pedidos de pasarela, gratuitos o anteriores al sistema. */
  readonly manualPayment: OrderManualPayment | null;
  readonly licenseStatus: LicenseStatus;
  readonly fulfillment: OrderFulfillment;
  readonly purchaseAccess: PurchaseAccess | null;
  readonly notifications: OrderNotifications;
  /** ISO 8601 en UTC. */
  readonly createdAt: string;
  /** ISO 8601 en UTC. */
  readonly updatedAt: string;
}
