import type { LicenseErrorCode } from "@/types/license";

export type FulfillmentOperationStatus = "pending" | "issued" | "failed";

/** Registro privado que coordina reintentos y procesos simultáneos por ítem. */
export interface FulfillmentOperation {
  readonly orderId: string;
  readonly productId: string;
  readonly appId: string;
  readonly idempotencyKey: string;
  readonly status: FulfillmentOperationStatus;
  readonly attemptId: string;
  readonly attemptCount: number;
  readonly leaseUntil: string | null;
  readonly licenseKey: string | null;
  readonly issuedAt: string | null;
  readonly errorCode: LicenseErrorCode | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type FulfillmentResultStatus =
  | "fulfilled"
  | "partial"
  | "pending"
  | "failed"
  | "rejected";

export interface FulfillmentItemResult {
  readonly productId: string;
  readonly appId: string;
  readonly licenseStatus: "not_requested" | "pending" | "issued" | "failed";
  readonly downloadReady: boolean;
  readonly errorCode: LicenseErrorCode | null;
}

export interface FulfillmentResult {
  readonly status: FulfillmentResultStatus;
  readonly orderId: string;
  readonly items: readonly FulfillmentItemResult[];
  readonly message: string;
}
