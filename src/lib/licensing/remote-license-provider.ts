import "server-only";

import type { LicenseProvider } from "@/lib/licensing/license-provider";
import { SIGNATURE_HEADERS, signRequest } from "@/lib/licensing/request-signing";
import type {
  IssueLicenseInput,
  IssueLicenseResult,
  IssuedLicense,
  LicenseErrorCode,
  LicenseLookupInput,
  LicenseLookupResult,
  LicenseStatus,
  LicenseValidationInput,
  LicenseValidationResult,
} from "@/types/license";

/**
 * Adaptador para la futura API de licencias propia (`LICENSE_PROVIDER=remote`).
 *
 * El contrato completo está en `docs/contrato-api-licencias.md`. Todas las llamadas
 * salen del servidor: la API key y el secreto de firma nunca llegan al navegador.
 */

export const REMOTE_LICENSE_PATHS = {
  assign: "/api/licenses/assign",
  lookup: "/api/licenses/lookup",
  validate: "/api/licenses/validate",
} as const;

export interface RemoteLicenseApiConfiguration {
  readonly baseUrl: string;
  readonly apiKey: string;
  /** Opcional. Con valor, cada solicitud viaja firmada con HMAC. */
  readonly signingSecret?: string | null;
  readonly environment?: string | undefined;
  readonly fetchImplementation?: typeof fetch;
  readonly clock?: () => Date;
  readonly requestId?: () => string;
  readonly timeoutMs?: number;
}

const REMOTE_STATUS: Readonly<Record<string, LicenseStatus>> = {
  assigned: "SOLD",
  sold: "SOLD",
  activated: "ACTIVATED",
  blocked: "BLOCKED",
  revoked: "REVOKED",
  released: "RELEASED",
};

const REMOTE_ERRORS: readonly LicenseErrorCode[] = [
  "NO_LICENSE_AVAILABLE",
  "INVALID_APP",
  "INVALID_REQUEST",
  "IDEMPOTENCY_CONFLICT",
  "ORDER_ALREADY_HAS_LICENSE",
  "UNAUTHORIZED_SERVICE",
  "RATE_LIMITED",
  "INTERNAL_ERROR",
  "LICENSE_NOT_FOUND",
];

const MAX_RESPONSE_BYTES = 64 * 1024;

type Failure = { readonly ok: false; readonly error: LicenseErrorCode; readonly message: string };

function failure(error: LicenseErrorCode, message: string): Failure {
  return { ok: false, error, message };
}

export function validRemoteBaseUrl(value: string, environment: string | undefined): URL | null {
  try {
    const url = new URL(value);
    if (url.username !== "" || url.password !== "" || url.search !== "" || url.hash !== "") {
      return null;
    }
    if (url.protocol !== "https:" && !(url.protocol === "http:" && environment !== "production")) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function isRemoteLicenseConfigurationValid(configuration: {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly signingSecret?: string | null;
  readonly environment?: string | undefined;
}): boolean {
  const secret = configuration.signingSecret ?? null;
  return (
    validRemoteBaseUrl(configuration.baseUrl, configuration.environment) !== null &&
    configuration.apiKey.length >= 32 &&
    (secret === null || secret === "" || secret.length >= 32)
  );
}

function statusFailure(status: number): Failure {
  if (status === 401 || status === 403) {
    return failure("UNAUTHORIZED_SERVICE", "La API de licencias rechazó las credenciales de la tienda.");
  }
  if (status === 404) return failure("LICENSE_NOT_FOUND", "La API de licencias no encontró el recurso.");
  if (status === 409) return failure("IDEMPOTENCY_CONFLICT", "La API de licencias informó un conflicto.");
  if (status === 400 || status === 422) {
    return failure("INVALID_REQUEST", "La API de licencias rechazó la solicitud.");
  }
  if (status === 429) return failure("RATE_LIMITED", "La API de licencias pidió esperar antes de reintentar.");
  return failure("LICENSE_API_UNAVAILABLE", "La API de licencias no está disponible en este momento.");
}

function payloadFailure(payload: unknown, status: number): Failure {
  const error = (payload as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  if (typeof error?.code === "string" && REMOTE_ERRORS.includes(error.code as LicenseErrorCode)) {
    const message =
      typeof error.message === "string" && error.message.trim() !== ""
        ? error.message.slice(0, 300)
        : "La API de licencias rechazó la solicitud.";
    return failure(error.code as LicenseErrorCode, message);
  }
  return statusFailure(status);
}

function parseLicense(
  data: Record<string, unknown>,
  expectedAppId: string,
  now: Date,
): IssuedLicense | null {
  const licenseKey = data.licenseKey;
  if (typeof licenseKey !== "string" || licenseKey.trim() === "" || licenseKey.length > 200) return null;

  const licenseId = data.licenseId;
  if (licenseId !== undefined && licenseId !== null && (typeof licenseId !== "string" || licenseId.length > 200)) {
    return null;
  }

  if (data.appId !== undefined && data.appId !== expectedAppId) return null;

  const rawStatus = data.status ?? "assigned";
  const status = typeof rawStatus === "string" ? REMOTE_STATUS[rawStatus.toLowerCase()] : undefined;
  if (status === undefined) return null;

  const rawAssignedAt = data.assignedAt;
  if (rawAssignedAt !== undefined && (typeof rawAssignedAt !== "string" || Number.isNaN(Date.parse(rawAssignedAt)))) {
    return null;
  }

  if (data.replayed !== undefined && typeof data.replayed !== "boolean") return null;

  return {
    licenseKey,
    licenseId: typeof licenseId === "string" ? licenseId : null,
    appId: expectedAppId,
    status,
    issuedAt:
      typeof rawAssignedAt === "string" ? new Date(rawAssignedAt).toISOString() : now.toISOString(),
    replayed: data.replayed === true,
  };
}

export function createRemoteLicenseProvider(
  configuration: RemoteLicenseApiConfiguration,
): LicenseProvider {
  const baseUrl = validRemoteBaseUrl(configuration.baseUrl, configuration.environment);
  const configured = isRemoteLicenseConfigurationValid(configuration);
  const signingSecret = configuration.signingSecret?.trim() || null;
  const request = configuration.fetchImplementation ?? fetch;
  const clock = configuration.clock ?? (() => new Date());
  const newRequestId = configuration.requestId ?? (() => crypto.randomUUID());
  const timeoutMs = configuration.timeoutMs ?? 15_000;

  function endpoint(path: string): URL | null {
    if (baseUrl === null) return null;
    const url = new URL(baseUrl.toString());
    url.pathname = `${baseUrl.pathname.replace(/\/+$/, "")}${path}`;
    return url;
  }

  /** Hace el POST firmado y devuelve el cuerpo JSON o una falla controlada. */
  async function post(
    path: string,
    body: Record<string, unknown>,
    idempotencyKey: string | null,
  ): Promise<{ readonly ok: true; readonly status: number; readonly payload: Record<string, unknown> } | Failure> {
    const url = endpoint(path);
    if (!configured || url === null) {
      return failure(
        "LICENSE_API_INVALID_CONFIGURATION",
        "La conexión server-to-server con la API de licencias no es válida.",
      );
    }

    const serialized = JSON.stringify(body);
    const requestId = newRequestId();
    const timestamp = String(Math.floor(clock().getTime() / 1000));
    const headers: Record<string, string> = {
      Authorization: `Bearer ${configuration.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      [SIGNATURE_HEADERS.requestId]: requestId,
      [SIGNATURE_HEADERS.timestamp]: timestamp,
    };
    if (idempotencyKey !== null) headers["Idempotency-Key"] = idempotencyKey;
    if (signingSecret !== null) {
      headers[SIGNATURE_HEADERS.signature] = signRequest(signingSecret, {
        method: "POST",
        path: url.pathname,
        timestamp,
        requestId,
        body: serialized,
      });
    }

    let response: Response;
    try {
      response = await request(url, {
        method: "POST",
        headers,
        body: serialized,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      return failure("LICENSE_API_UNAVAILABLE", "La API de licencias no está disponible en este momento.");
    }

    let payload: unknown = null;
    try {
      const text = await response.text();
      if (text.length > MAX_RESPONSE_BYTES) {
        return failure("LICENSE_API_INVALID_RESPONSE", "La API de licencias devolvió una respuesta demasiado grande.");
      }
      payload = text === "" ? null : JSON.parse(text);
    } catch {
      payload = null;
    }

    if (!response.ok) return payloadFailure(payload, response.status);
    if (typeof payload !== "object" || payload === null || (payload as { success?: unknown }).success !== true) {
      return failure("LICENSE_API_INVALID_RESPONSE", "La API de licencias devolvió una respuesta incompatible.");
    }
    return { ok: true, status: response.status, payload: payload as Record<string, unknown> };
  }

  return {
    name: "RemoteLicenseProvider",
    enabled: configured,

    async issueLicense(input: IssueLicenseInput): Promise<IssueLicenseResult> {
      const result = await post(
        REMOTE_LICENSE_PATHS.assign,
        {
          orderId: input.orderReference ?? input.orderId,
          orderUuid: input.orderId,
          productId: input.productId ?? null,
          appId: input.appId,
          userId: input.customerId ?? null,
          customerEmail: input.customerEmail,
          purchaseId: input.idempotencyKey,
        },
        input.idempotencyKey,
      );
      if (!result.ok) return result;

      const license = parseLicense(result.payload, input.appId, clock());
      if (license === null) {
        return failure("LICENSE_API_INVALID_RESPONSE", "La API de licencias devolvió una respuesta incompatible.");
      }
      return { ok: true, license };
    },

    async getLicense(input: LicenseLookupInput): Promise<LicenseLookupResult> {
      const result = await post(
        REMOTE_LICENSE_PATHS.lookup,
        {
          orderId: input.orderReference ?? input.orderId,
          orderUuid: input.orderId,
          productId: input.productId,
          appId: input.appId,
          purchaseId: input.idempotencyKey,
        },
        null,
      );
      if (!result.ok) {
        return result.error === "LICENSE_NOT_FOUND" ? { ok: true, found: false } : result;
      }
      if (result.payload.found === false) return { ok: true, found: false };
      const license = parseLicense(result.payload, input.appId, clock());
      if (license === null) {
        return failure("LICENSE_API_INVALID_RESPONSE", "La API de licencias devolvió una respuesta incompatible.");
      }
      return { ok: true, found: true, license };
    },

    async validateLicense(input: LicenseValidationInput): Promise<LicenseValidationResult> {
      const result = await post(
        REMOTE_LICENSE_PATHS.validate,
        { appId: input.appId, licenseKey: input.licenseKey },
        null,
      );
      if (!result.ok) return result;
      const valid = result.payload.valid;
      const rawStatus = result.payload.status;
      if (typeof valid !== "boolean") {
        return failure("LICENSE_API_INVALID_RESPONSE", "La API de licencias devolvió una respuesta incompatible.");
      }
      const status =
        typeof rawStatus === "string" ? REMOTE_STATUS[rawStatus.toLowerCase()] ?? null : null;
      return { ok: true, valid, status };
    },
  };
}
