import "server-only";
import { createDisabledLicenseProvider } from "@/lib/licensing/disabled-license-provider";
import type { LicenseProvider } from "@/lib/licensing/license-provider";
import { createMockLicenseProvider } from "@/lib/licensing/mock-license-provider";
import {
  createRemoteLicenseProvider,
  isRemoteLicenseConfigurationValid,
} from "@/lib/licensing/remote-license-provider";
import { createRxwCoreLicenseProvider } from "@/lib/licensing/rxw-core-license-provider";

export type { LicenseProvider } from "@/lib/licensing/license-provider";

/**
 * Registro de proveedores de licencias.
 *
 *   none     → seguro por defecto: el pago se confirma y la licencia queda pendiente
 *   mock     → solo desarrollo y tests; producción lo bloquea
 *   rxw-core → sistema de licencias actual (RXW-CORE 0.8.x)
 *   remote   → futura página/API de licencias propia (contrato en docs/)
 *
 * Cambiar de proveedor es cambiar LICENSE_PROVIDER y sus variables: el resto de la
 * tienda no se modifica.
 */

export interface LicenseConfiguration {
  readonly requestedProvider: string;
  readonly activeProvider: string | null;
  readonly ready: boolean;
  readonly message: string;
}

function requestedProvider(): string {
  return (process.env.LICENSE_PROVIDER ?? "none").trim().toLowerCase() || "none";
}

function remoteConfiguration() {
  return {
    baseUrl: process.env.LICENSE_API_URL?.trim() ?? "",
    apiKey: process.env.LICENSE_API_KEY ?? "",
    signingSecret: process.env.LICENSE_API_SIGNING_SECRET ?? null,
    environment: process.env.NODE_ENV,
  };
}

export function getLicenseConfiguration(): LicenseConfiguration {
  const requested = requestedProvider();

  if (requested === "none") {
    return {
      requestedProvider: requested,
      activeProvider: null,
      ready: false,
      message: "RXW-CORE todavía no está configurado.",
    };
  }

  if (requested === "mock") {
    const ready = process.env.NODE_ENV !== "production";
    return {
      requestedProvider: requested,
      activeProvider: ready ? "mock" : null,
      ready,
      message: ready
        ? "Mock de licencias activo solamente para desarrollo/tests."
        : "MockLicenseProvider está prohibido en producción.",
    };
  }

  if (requested === "rxw-core") {
    const ready = Boolean(
      process.env.RXW_CORE_BASE_URL?.trim() &&
        process.env.RXW_STORE_SERVICE_ID?.trim() &&
        process.env.RXW_STORE_SERVICE_SECRET &&
        process.env.RXW_STORE_SERVICE_SECRET.length >= 32,
    );
    return {
      requestedProvider: requested,
      activeProvider: ready ? "rxw-core" : null,
      ready,
      message: ready
        ? "RXW-CORE configurado para comunicación server-to-server."
        : "Faltan variables server-side de RXW-CORE.",
    };
  }

  if (requested === "remote") {
    const configuration = remoteConfiguration();
    const ready = isRemoteLicenseConfigurationValid(configuration);
    const signed = Boolean(configuration.signingSecret?.trim());
    return {
      requestedProvider: requested,
      activeProvider: ready ? "remote" : null,
      ready,
      message: ready
        ? `API de licencias remota configurada${signed ? " con firma HMAC" : " sin firma HMAC"}.`
        : "Faltan o no son válidas LICENSE_API_URL y LICENSE_API_KEY (mínimo 32 caracteres).",
    };
  }

  return {
    requestedProvider: requested,
    activeProvider: null,
    ready: false,
    message: `El proveedor de licencias “${requested}” no está registrado.`,
  };
}

let provider: LicenseProvider | null = null;

export function getLicenseProvider(): LicenseProvider {
  if (provider !== null) return provider;

  const requested = requestedProvider();
  if (requested === "mock") {
    provider =
      process.env.NODE_ENV === "production"
        ? createDisabledLicenseProvider("MockLicenseProvider está prohibido en producción.")
        : createMockLicenseProvider();
    return provider;
  }

  if (requested === "rxw-core") {
    provider = createRxwCoreLicenseProvider({
      baseUrl: process.env.RXW_CORE_BASE_URL ?? "",
      serviceId: process.env.RXW_STORE_SERVICE_ID ?? "",
      serviceSecret: process.env.RXW_STORE_SERVICE_SECRET ?? "",
      environment: process.env.NODE_ENV,
    });
    return provider;
  }

  if (requested === "remote") {
    provider = createRemoteLicenseProvider(remoteConfiguration());
    return provider;
  }

  provider = createDisabledLicenseProvider(getLicenseConfiguration().message);
  return provider;
}
