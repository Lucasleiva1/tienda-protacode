import "server-only";
import type { LicenseProvider } from "@/lib/licensing/license-provider";

/** Ausencia segura: jamás fabrica una clave ni marca la licencia como emitida. */
export function createDisabledLicenseProvider(
  message = "RXW-CORE todavía no está configurado.",
): LicenseProvider {
  return {
    name: "DisabledLicenseProvider",
    enabled: false,

    async issueLicense() {
      return {
        ok: false,
        error: "RXW_CORE_NOT_CONFIGURED" as const,
        message,
      };
    },
  };
}
