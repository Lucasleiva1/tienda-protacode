import "server-only";
import type { LicenseProvider } from "@/lib/licensing/license-provider";
import type {
  IssueLicenseInput,
  IssueLicenseResult,
  LicenseErrorCode,
  LicenseStatus,
} from "@/types/license";

const RXW_STATUSES: readonly LicenseStatus[] = [
  "AVAILABLE",
  "RESERVED",
  "SOLD",
  "ACTIVATED",
  "BLOCKED",
  "RELEASED",
  "REVOKED",
];

const RXW_ERRORS: readonly LicenseErrorCode[] = [
  "NO_LICENSE_AVAILABLE",
  "INVALID_APP",
  "INVALID_REQUEST",
  "IDEMPOTENCY_CONFLICT",
  "ORDER_ALREADY_HAS_LICENSE",
  "SERVICE_AUTH_NOT_CONFIGURED",
  "UNAUTHORIZED_SERVICE",
  "INVALID_SERVICE",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
];

export interface RxwCoreConfiguration {
  readonly baseUrl: string;
  readonly serviceId: string;
  readonly serviceSecret: string;
  readonly environment?: string | undefined;
  readonly fetchImplementation?: typeof fetch | undefined;
}

interface RxwSuccessPayload {
  readonly ok: true;
  readonly data: {
    readonly licenseKey: string;
    readonly appId: string;
    readonly status: LicenseStatus;
    readonly orderId: string;
    readonly deliveredAt: string;
    readonly replayed: boolean;
  };
}

interface RxwErrorPayload {
  readonly ok: false;
  readonly error: { readonly code: string; readonly message: string };
}

function validBaseUrl(value: string, environment: string | undefined): URL | null {
  try {
    const url = new URL(value);
    if (url.username !== "" || url.password !== "") return null;
    if (environment === "production" && url.protocol !== "https:") return null;
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

function controlledError(code: string, message: string): IssueLicenseResult {
  return {
    ok: false,
    error: RXW_ERRORS.includes(code as LicenseErrorCode)
      ? (code as LicenseErrorCode)
      : "RXW_CORE_UNAVAILABLE",
    message: message.trim() === "" ? "RXW-CORE rechazó la solicitud." : message,
  };
}

/** Adapter exacto para el contrato RXW Core 0.8.0. */
export function createRxwCoreLicenseProvider(
  configuration: RxwCoreConfiguration,
): LicenseProvider {
  const baseUrl = validBaseUrl(configuration.baseUrl, configuration.environment);
  const configured =
    baseUrl !== null &&
    /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(configuration.serviceId) &&
    configuration.serviceId.length >= 2 &&
    configuration.serviceId.length <= 64 &&
    configuration.serviceSecret.length >= 32;
  const request = configuration.fetchImplementation ?? fetch;

  return {
    name: "RxwCoreLicenseProvider",
    enabled: configured,

    async issueLicense(input: IssueLicenseInput): Promise<IssueLicenseResult> {
      if (!configured || baseUrl === null) {
        return {
          ok: false,
          error: "RXW_CORE_INVALID_CONFIGURATION",
          message: "La conexión server-to-server con RXW-CORE no es válida.",
        };
      }

      try {
        const response = await request(new URL("/api/licenses/issue", baseUrl), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${configuration.serviceSecret}`,
            "X-RXW-Service-Id": configuration.serviceId,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            appId: input.appId,
            orderId: input.orderId,
            idempotencyKey: input.idempotencyKey,
            customerEmail: input.customerEmail,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(15_000),
        });

        const payload = (await response.json()) as RxwSuccessPayload | RxwErrorPayload;
        if (!response.ok) {
          if (payload.ok === false && typeof payload.error?.code === "string") {
            return controlledError(payload.error.code, payload.error.message);
          }
          return {
            ok: false,
            error: "RXW_CORE_UNAVAILABLE",
            message: "RXW-CORE no pudo procesar la solicitud.",
          };
        }

        if (
          payload.ok !== true ||
          typeof payload.data?.licenseKey !== "string" ||
          payload.data.licenseKey.trim() === "" ||
          payload.data.appId !== input.appId ||
          payload.data.orderId !== input.orderId ||
          !RXW_STATUSES.includes(payload.data.status) ||
          Number.isNaN(Date.parse(payload.data.deliveredAt)) ||
          typeof payload.data.replayed !== "boolean"
        ) {
          return {
            ok: false,
            error: "RXW_CORE_INVALID_RESPONSE",
            message: "RXW-CORE devolvió una respuesta incompatible.",
          };
        }

        return {
          ok: true,
          license: {
            licenseKey: payload.data.licenseKey,
            appId: payload.data.appId,
            status: payload.data.status,
            issuedAt: payload.data.deliveredAt,
            replayed: payload.data.replayed,
          },
        };
      } catch {
        return {
          ok: false,
          error: "RXW_CORE_UNAVAILABLE",
          message: "RXW-CORE no está disponible en este momento.",
        };
      }
    },
  };
}
