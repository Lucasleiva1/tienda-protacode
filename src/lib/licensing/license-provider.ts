/**
 * Puerto de licencias.
 *
 * Todo lo que necesite emitir una licencia habla con esta interfaz, nunca con una
 * implementación concreta. Hoy la cumple `MockLicenseProvider`; mañana la va a
 * cumplir `RxwCoreLicenseProvider` sin que cambie una línea del checkout ni de un
 * componente.
 */

import type { IssueLicenseInput, IssueLicenseResult } from "@/types/license";

export interface LicenseProvider {
  /** Nombre de la implementación activa. Sirve para logs y para verlo en desarrollo. */
  readonly name: string;
  readonly enabled: boolean;

  issueLicense(input: IssueLicenseInput): Promise<IssueLicenseResult>;
}
