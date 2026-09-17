/**
 * Puerto de licencias.
 *
 * Todo lo que necesite una licencia habla con esta interfaz, nunca con una
 * implementación concreta. Cambiar de proveedor (`rxw-core` hoy, `remote` mañana) es
 * cambiar la configuración: el checkout, los pagos y las pantallas no se tocan.
 *
 * Equivalencias con el vocabulario del negocio:
 *   issueLicense    → assignLicense(order)
 *   getLicense      → getLicense(order)       (opcional según el proveedor)
 *   validateLicense → validateLicense(...)    (opcional según el proveedor)
 */

import type {
  IssueLicenseInput,
  IssueLicenseResult,
  LicenseLookupInput,
  LicenseLookupResult,
  LicenseValidationInput,
  LicenseValidationResult,
} from "@/types/license";

export interface LicenseProvider {
  /** Nombre de la implementación activa. Sirve para logs y para verlo en desarrollo. */
  readonly name: string;
  readonly enabled: boolean;

  /**
   * Asigna la licencia de un ítem pagado. Repetir la misma `idempotencyKey` tiene que
   * devolver la misma licencia, nunca una segunda.
   */
  issueLicense(input: IssueLicenseInput): Promise<IssueLicenseResult>;

  /** Consulta una licencia ya asignada sin crear otra. */
  getLicense?(input: LicenseLookupInput): Promise<LicenseLookupResult>;

  /** Pregunta al sistema de licencias si una clave es válida para una aplicación. */
  validateLicense?(input: LicenseValidationInput): Promise<LicenseValidationResult>;
}
