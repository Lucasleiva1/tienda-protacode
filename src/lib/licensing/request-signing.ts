import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Firma HMAC de las solicitudes tienda → API de licencias.
 *
 * Qué protege:
 *   - integridad: nadie puede cambiar el cuerpo, el método ni la ruta sin invalidar
 *     la firma;
 *   - repetición: la firma incluye un timestamp y un identificador único; el servidor
 *     de licencias rechaza timestamps viejos y ids ya vistos.
 *
 * El secreto de firma nunca viaja en la solicitud. Este archivo documenta también la
 * verificación exacta que tiene que implementar el sistema de licencias.
 */

export const SIGNATURE_VERSION = "v1";
export const SIGNATURE_TOLERANCE_SECONDS = 300;

export const SIGNATURE_HEADERS = {
  requestId: "X-Protacode-Request-Id",
  timestamp: "X-Protacode-Timestamp",
  signature: "X-Protacode-Signature",
} as const;

export interface SignedRequestParts {
  readonly method: string;
  /** Solo la ruta, sin dominio ni query. Ej.: `/api/licenses/assign`. */
  readonly path: string;
  /** Segundos Unix, como texto decimal. */
  readonly timestamp: string;
  readonly requestId: string;
  /** Cuerpo exacto, tal como viaja. */
  readonly body: string;
}

export function canonicalRequest(parts: SignedRequestParts): string {
  const bodyHash = createHash("sha256").update(parts.body, "utf8").digest("hex");
  return [
    SIGNATURE_VERSION,
    parts.timestamp,
    parts.requestId,
    parts.method.toUpperCase(),
    parts.path,
    bodyHash,
  ].join("\n");
}

export function signRequest(secret: string, parts: SignedRequestParts): string {
  const digest = createHmac("sha256", secret).update(canonicalRequest(parts), "utf8").digest("hex");
  return `${SIGNATURE_VERSION}=${digest}`;
}

export type SignatureCheck = "valid" | "invalid" | "expired" | "malformed";

/**
 * Verificación del lado del sistema de licencias.
 *
 * Además de esto, el servidor debe guardar cada `requestId` aceptado durante la
 * ventana de tolerancia y rechazar los repetidos.
 */
export function verifyRequestSignature(input: {
  readonly secret: string;
  readonly signature: string | null;
  readonly parts: SignedRequestParts;
  readonly nowSeconds: number;
  readonly toleranceSeconds?: number;
}): SignatureCheck {
  const tolerance = input.toleranceSeconds ?? SIGNATURE_TOLERANCE_SECONDS;
  if (
    input.signature === null ||
    !/^\d{1,12}$/.test(input.parts.timestamp) ||
    !/^[A-Za-z0-9-]{16,64}$/.test(input.parts.requestId)
  ) {
    return "malformed";
  }
  if (Math.abs(input.nowSeconds - Number(input.parts.timestamp)) > tolerance) return "expired";

  const expected = Buffer.from(signRequest(input.secret, input.parts));
  const received = Buffer.from(input.signature);
  if (expected.length !== received.length) return "invalid";
  return timingSafeEqual(expected, received) ? "valid" : "invalid";
}
