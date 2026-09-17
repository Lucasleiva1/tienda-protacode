import "server-only";

import { createHash } from "node:crypto";
import { detectFileType, type DetectedFileType } from "@/lib/files/file-signature";
import { getKeyValueStore, STORES, type KeyValueStore } from "@/lib/storage/store";
import type { PaymentProofReference } from "@/types/manual-payment";

/**
 * Comprobantes de pago.
 *
 * Son privados: pueden tener datos bancarios del comprador. Se guardan en su propio
 * almacén y solo se sirven con sesión de Admin. Un comprobante es evidencia
 * auxiliar: nunca cambia el estado del pago.
 */

/** Deja margen para el sobre de la Server Action (límite de 4 MB). */
export const PAYMENT_PROOF_MAX_BYTES = 3 * 1024 * 1024;

export interface PaymentProofUpload {
  readonly bytes: Uint8Array;
  readonly contentType: DetectedFileType;
  readonly sha256: string;
}

export type InspectPaymentProofResult =
  | { readonly ok: true; readonly upload: PaymentProofUpload }
  | { readonly ok: false; readonly message: string };

export function inspectPaymentProofBytes(bytes: Uint8Array): InspectPaymentProofResult {
  if (bytes.byteLength === 0) return { ok: false, message: "El archivo está vacío." };
  if (bytes.byteLength > PAYMENT_PROOF_MAX_BYTES) {
    return { ok: false, message: "El comprobante pesa demasiado. El máximo es 3 MB." };
  }
  const contentType = detectFileType(bytes);
  if (contentType === null) {
    return { ok: false, message: "El comprobante tiene que ser una imagen JPG, PNG o WEBP, o un PDF." };
  }
  return {
    ok: true,
    upload: {
      bytes,
      contentType,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    },
  };
}

/** Lee el archivo de un FormData. `null` cuando no se adjuntó ninguno. */
export async function inspectPaymentProofFile(
  value: FormDataEntryValue | null,
): Promise<InspectPaymentProofResult | null> {
  if (!(value instanceof File) || value.size === 0) return null;
  if (value.size > PAYMENT_PROOF_MAX_BYTES) {
    return { ok: false, message: "El comprobante pesa demasiado. El máximo es 3 MB." };
  }
  return inspectPaymentProofBytes(new Uint8Array(await value.arrayBuffer()));
}

interface StoredProof {
  readonly orderId: string;
  readonly contentType: string;
  readonly base64: string;
  readonly size: number;
  readonly sha256: string;
  readonly uploadedAt: string;
}

export interface PaymentProofStorage {
  save(orderId: string, upload: PaymentProofUpload): Promise<PaymentProofReference>;
  read(
    reference: PaymentProofReference,
  ): Promise<{ readonly bytes: Uint8Array; readonly contentType: string } | null>;
  remove(storageKey: string): Promise<void>;
}

export function createPaymentProofStorage(
  store: KeyValueStore = getKeyValueStore(STORES.paymentProofs),
  clock: () => Date = () => new Date(),
): PaymentProofStorage {
  return {
    async save(orderId, upload) {
      const storageKey = `orders/${orderId.replace(/[^a-zA-Z0-9-]/g, "")}/${crypto.randomUUID()}`;
      const uploadedAt = clock().toISOString();
      await store.set<StoredProof>(storageKey, {
        orderId,
        contentType: upload.contentType,
        base64: Buffer.from(upload.bytes).toString("base64"),
        size: upload.bytes.byteLength,
        sha256: upload.sha256,
        uploadedAt,
      });
      return {
        storageKey,
        contentType: upload.contentType,
        size: upload.bytes.byteLength,
        sha256: upload.sha256,
        uploadedAt,
      };
    },

    async read(reference) {
      const stored = await store.get<StoredProof>(reference.storageKey);
      if (stored === null || stored.sha256 !== reference.sha256) return null;
      return {
        bytes: new Uint8Array(Buffer.from(stored.base64, "base64")),
        contentType: stored.contentType,
      };
    },

    async remove(storageKey) {
      await store.remove(storageKey);
    },
  };
}

let storage: PaymentProofStorage | null = null;

export function getPaymentProofStorage(): PaymentProofStorage {
  if (storage === null) storage = createPaymentProofStorage();
  return storage;
}
