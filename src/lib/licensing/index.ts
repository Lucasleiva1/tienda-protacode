import "server-only";
import { createDisabledLicenseProvider } from "@/lib/licensing/disabled-license-provider";
import type { LicenseProvider } from "@/lib/licensing/license-provider";
import { createMockLicenseProvider } from "@/lib/licensing/mock-license-provider";
import { createRxwCoreLicenseProvider } from "@/lib/licensing/rxw-core-license-provider";

export type { LicenseProvider } from "@/lib/licensing/license-provider";

export interface LicenseConfiguration {
  readonly requestedProvider: string;
  readonly activeProvider: string | null;
  readonly ready: boolean;
  readonly message: string;
}

function requestedProvider(): string {
  return (process.env.LICENSE_PROVIDER ?? "none").trim().toLowerCase() || "none";
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

  provider = createDisabledLicenseProvider(getLicenseConfiguration().message);
  return provider;
}
