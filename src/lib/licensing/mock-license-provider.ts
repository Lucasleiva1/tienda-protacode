/**
 * Proveedor de licencias SIMULADO. SOLO PARA DESARROLLO.
 *
 * No emite licencias reales, no habla con RXW-CORE, no hace ningún request y no
 * guarda nada en disco. Existe para que el resto del sistema pueda desarrollarse
 * contra un contrato que se comporta como el real.
 *
 * Lo único que imita en serio es la idempotencia: repetir la misma
 * `idempotencyKey` devuelve la misma licencia, que es la garantía de la que
 * depende un checkout para no entregar dos licencias por una sola venta.
 */

import type {
  IssueLicenseInput,
  IssueLicenseResult,
  IssuedLicense,
} from "@/types/license";
import type { LicenseProvider } from "./license-provider";

/** Prefijo imposible de confundir con una clave real de RXW-CORE (que usa "RXW-"). */
const MOCK_PREFIX = "MOCK-DEV";

/**
 * Corta si alguien intenta usar esto desde el navegador.
 *
 * La regla "las licencias nunca se tocan desde el cliente" no puede depender de que
 * alguien la recuerde. Acá se rompe fuerte y en el momento.
 */
function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error(
      "El proveedor de licencias es de servidor. No puede usarse en el navegador.",
    );
  }
}

/** Validación mínima de forma. La validación de verdad va donde exista el endpoint. */
function findProblem(input: IssueLicenseInput): string | null {
  if (input.appId.trim() === "") return "Falta appId.";
  if (input.orderId.trim() === "") return "Falta orderId.";
  if (input.idempotencyKey.trim() === "") return "Falta idempotencyKey.";
  if (!input.customerEmail.includes("@")) return "El email del comprador no es válido.";
  return null;
}

function buildMockKey(appId: string, sequence: number): string {
  const tag = appId.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6).padEnd(6, "X");
  return `${MOCK_PREFIX}-${tag}-${String(sequence).padStart(4, "0")}`;
}

export function createMockLicenseProvider(
  environment = process.env.NODE_ENV,
): LicenseProvider {
  assertServerOnly();

  if (environment === "production") {
    throw new Error("MOCK_LICENSE_FORBIDDEN_IN_PRODUCTION");
  }

  // En memoria a propósito: se pierde al reiniciar y no deja rastro en ningún lado.
  const issued = new Map<string, IssuedLicense>();
  let sequence = 0;

  return {
    name: "MockLicenseProvider",
    enabled: true,

    async issueLicense(input: IssueLicenseInput): Promise<IssueLicenseResult> {
      assertServerOnly();

      const problem = findProblem(input);
      if (problem !== null) {
        return { ok: false, error: "INVALID_REQUEST", message: problem };
      }

      const previous = issued.get(input.idempotencyKey);
      if (previous !== undefined) {
        // Misma clave con otra aplicación: es un error del que llama, no un replay.
        if (previous.appId !== input.appId) {
          return {
            ok: false,
            error: "IDEMPOTENCY_CONFLICT",
            message:
              "Esa idempotencyKey ya se usó para otra aplicación. Usá una clave distinta.",
          };
        }
        return { ok: true, license: { ...previous, replayed: true } };
      }

      sequence += 1;
      const license: IssuedLicense = {
        licenseKey: buildMockKey(input.appId, sequence),
        appId: input.appId,
        status: "SOLD",
        issuedAt: new Date().toISOString(),
        replayed: false,
      };
      issued.set(input.idempotencyKey, license);

      return { ok: true, license };
    },
  };
}
