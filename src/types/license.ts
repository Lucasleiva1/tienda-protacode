/**
 * Contrato de licencias.
 *
 * Prota Code NO genera, valida, activa, libera ni revoca licencias. Eso pertenece a
 * RXW-CORE, que es un proyecto aparte. La tienda únicamente solicita una licencia
 * después de un pago confirmado y conserva la clave emitida para entregársela al
 * comprador desde su página privada.
 */

/**
 * Estados posibles de una licencia en RXW-CORE. La tienda solo los lee.
 *
 * Recorrido normal de una venta:
 *   AVAILABLE → RESERVED → SOLD → ACTIVATED
 *
 * BLOCKED, RELEASED y REVOKED son estados de soporte que administra RXW-CORE.
 */
export type LicenseStatus =
  | "AVAILABLE"
  | "RESERVED"
  | "SOLD"
  | "ACTIVATED"
  | "BLOCKED"
  | "RELEASED"
  | "REVOKED";

export interface IssueLicenseInput {
  /** Debe coincidir exactamente con el `appId` registrado en RXW-CORE. */
  readonly appId: string;

  readonly orderId: string;

  readonly customerEmail: string;

  /**
   * Clave de idempotencia.
   *
   * Repetir la misma clave con los mismos datos tiene que devolver la MISMA
   * licencia, nunca una segunda. Es lo que evita entregar dos licencias cuando el
   * checkout reintenta por un corte de red o un doble clic.
   */
  readonly idempotencyKey: string;

  /** Producto de la tienda. Lo usan los proveedores que asignan por producto. */
  readonly productId?: string;

  /** Referencia legible del pedido (PC-1051). */
  readonly orderReference?: string | null;

  /** Cuenta interna del comprador; `null` en compras como invitado. */
  readonly customerId?: string | null;
}

export interface IssuedLicense {
  readonly licenseKey: string;
  readonly appId: string;
  readonly status: LicenseStatus;
  readonly issuedAt: string;
  readonly replayed: boolean;
  /** Identificador de la licencia en el sistema externo, si lo informa. */
  readonly licenseId?: string | null;
}

/** Consulta de una licencia ya asignada, sin pedir una nueva. */
export interface LicenseLookupInput {
  readonly appId: string;
  readonly orderId: string;
  readonly orderReference: string | null;
  readonly productId: string;
  /** Misma clave estable con la que se asignó. */
  readonly idempotencyKey: string;
}

export type LicenseLookupResult =
  | { readonly ok: true; readonly found: false }
  | { readonly ok: true; readonly found: true; readonly license: IssuedLicense }
  | { readonly ok: false; readonly error: LicenseErrorCode; readonly message: string };

export interface LicenseValidationInput {
  readonly appId: string;
  readonly licenseKey: string;
}

export type LicenseValidationResult =
  | { readonly ok: true; readonly valid: boolean; readonly status: LicenseStatus | null }
  | { readonly ok: false; readonly error: LicenseErrorCode; readonly message: string };

export type LicenseErrorCode =
  | "RXW_CORE_NOT_CONFIGURED"
  | "RXW_CORE_INVALID_CONFIGURATION"
  | "RXW_CORE_INVALID_RESPONSE"
  | "RXW_CORE_UNAVAILABLE"
  | "MOCK_LICENSE_FORBIDDEN_IN_PRODUCTION"
  | "NO_LICENSE_AVAILABLE"
  | "INVALID_APP"
  | "INVALID_REQUEST"
  | "IDEMPOTENCY_CONFLICT"
  | "ORDER_ALREADY_HAS_LICENSE"
  | "SERVICE_AUTH_NOT_CONFIGURED"
  | "UNAUTHORIZED_SERVICE"
  | "INVALID_SERVICE"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR"
  | "LICENSE_API_INVALID_CONFIGURATION"
  | "LICENSE_API_UNAVAILABLE"
  | "LICENSE_API_INVALID_RESPONSE"
  | "LICENSE_NOT_FOUND"
  | "OPERATION_NOT_SUPPORTED";

/**
 * Resultado de emitir una licencia.
 *
 * Es una unión discriminada en vez de una excepción: obliga a mirar `ok` antes de
 * poder leer la licencia, así no se puede ignorar una falla por descuido. La forma
 * es la misma que ya devuelve RXW-CORE en sus respuestas.
 */
export type IssueLicenseResult =
  | { readonly ok: true; readonly license: IssuedLicense }
  | {
      readonly ok: false;
      readonly error: LicenseErrorCode;
      readonly message: string;
    };
