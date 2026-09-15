import "server-only";
import {
  getProductDownloadRepository,
  type ProductDownloadRepository,
} from "@/features/downloads/product-download-repository";
import {
  getFulfillmentRepository,
  type FulfillmentRepository,
} from "@/features/fulfillment/fulfillment-repository";
import { fulfillmentLog } from "@/features/fulfillment/fulfillment-logger";
import { getOrderRepository } from "@/features/orders/persistent-order-repository";
import type { OrderRepository } from "@/features/orders/order-repository";
import { isOrderId } from "@/features/orders/order-service";
import { getPaymentRepository } from "@/features/payments/persistent-payment-repository";
import type { PaymentRepository } from "@/features/payments/payment-repository";
import { getLicenseProvider, type LicenseProvider } from "@/lib/licensing";
import type {
  FulfillmentItemResult,
  FulfillmentResult,
  FulfillmentResultStatus,
} from "@/types/fulfillment";
import type { LicenseErrorCode } from "@/types/license";
import type { LicenseStatus, Order, OrderItem } from "@/types/order";

export interface FulfillmentDependencies {
  readonly orders: OrderRepository;
  readonly payments: PaymentRepository;
  readonly operations: FulfillmentRepository;
  readonly downloads: ProductDownloadRepository;
  readonly licenses: LicenseProvider;
}

function idempotencyKey(orderId: string, productId: string): string {
  return `license:${orderId}:${productId}`;
}

function aggregateLicenseStatus(items: readonly OrderItem[]): LicenseStatus {
  if (items.every((item) => item.licenseStatus === "issued")) return "issued";
  if (items.some((item) => item.licenseStatus === "pending")) return "pending";
  if (items.some((item) => item.licenseStatus === "failed")) return "failed";
  return "not_requested";
}

function resultStatus(order: Order): FulfillmentResultStatus {
  if (order.status === "fulfilled") return "fulfilled";
  if (order.fulfillment.status === "partial") return "partial";
  if (order.fulfillment.status === "pending") return "pending";
  return "failed";
}

function itemResults(items: readonly OrderItem[]): readonly FulfillmentItemResult[] {
  return items.map((item) => ({
    productId: item.productId,
    appId: item.appId,
    licenseStatus: item.licenseStatus,
    downloadReady: item.downloadFile !== null,
    errorCode: (item.licenseError as LicenseErrorCode | null) ?? null,
  }));
}

function summary(order: Order): FulfillmentResult {
  const status = resultStatus(order);
  const messages: Record<FulfillmentResultStatus, string> = {
    fulfilled: "La compra quedó completamente entregada.",
    partial: "Parte de la entrega está lista y el resto puede reintentarse.",
    pending: "La entrega se está procesando.",
    failed: "El pago sigue confirmado, pero la entrega requiere un reintento.",
    rejected: "El pedido o el pago no habilitan fulfillment.",
  };
  return { status, orderId: order.id, items: itemResults(order.items), message: messages[status] };
}

export class FulfillmentService {
  constructor(private readonly dependencies: FulfillmentDependencies) {}

  async fulfill(orderId: string): Promise<FulfillmentResult> {
    if (!isOrderId(orderId)) return this.rejected(orderId, "El pedido no existe.");

    const initial = await this.dependencies.orders.findById(orderId);
    if (initial === null) return this.rejected(orderId, "El pedido no existe.");

    const payment = await this.dependencies.payments.findByOrderId(orderId);
    if (
      (initial.status !== "paid" && initial.status !== "fulfilled") ||
      initial.payment.status !== "approved" ||
      payment?.status !== "approved"
    ) {
      return this.rejected(orderId, "El pago no está aprobado por el servidor.", initial);
    }

    if (initial.status === "fulfilled") return summary(initial);

    fulfillmentLog("info", "FULFILLMENT_STARTED", { orderId });
    await this.dependencies.orders.updateAtomically(orderId, (order) => ({
      ...order,
      fulfillment: {
        ...order.fulfillment,
        status: "pending",
        lastAttemptAt: new Date().toISOString(),
        lastError: null,
      },
    }));

    // Secuencial a propósito: evita que dos ítems pisen proyecciones del mismo Order.
    for (const originalItem of initial.items) {
      await this.processItem(orderId, originalItem.productId);
    }

    const completed = await this.finalize(orderId);
    return completed === null
      ? this.rejected(orderId, "El pedido no existe.")
      : summary(completed);
  }

  private async processItem(orderId: string, productId: string): Promise<void> {
    const order = await this.dependencies.orders.findById(orderId);
    const item = order?.items.find((candidate) => candidate.productId === productId);
    if (order === null || order === undefined || item === undefined) return;

    const availableDownload = await this.dependencies.downloads.find(
      item.productId,
      item.version,
    );

    if (item.licenseStatus === "issued" && item.licenseKey !== null) {
      if (item.downloadFile === null && availableDownload !== null) {
        await this.projectIssued(
          orderId,
          productId,
          item.licenseKey,
          item.issuedAt ?? new Date().toISOString(),
          availableDownload.file,
        );
      }
      return;
    }

    const key = idempotencyKey(orderId, productId);
    const claim = await this.dependencies.operations.claim({
      orderId,
      productId,
      appId: item.appId,
      idempotencyKey: key,
    });

    if (claim.kind === "issued") {
      if (claim.operation.licenseKey === null || claim.operation.issuedAt === null) {
        throw new Error("FULFILLMENT_ISSUED_OPERATION_INVALID");
      }
      await this.projectIssued(
        orderId,
        productId,
        claim.operation.licenseKey,
        claim.operation.issuedAt,
        availableDownload?.file ?? null,
      );
      return;
    }

    await this.updateItem(orderId, productId, (current) => ({
      ...current,
      licenseStatus: "pending",
      licenseError: null,
    }));
    if (claim.kind === "busy") return;

    fulfillmentLog("info", "LICENSE_REQUESTED", {
      orderId,
      productId,
      appId: item.appId,
      attempt: claim.operation.attemptCount,
    });
    const issued = await this.dependencies.licenses.issueLicense({
      appId: item.appId,
      orderId,
      customerEmail: order.customer.email,
      idempotencyKey: key,
    });

    if (!issued.ok) {
      await this.dependencies.operations.fail(claim.operation, issued.error);
      await this.updateItem(orderId, productId, (current) => ({
        ...current,
        licenseStatus: "failed",
        licenseError: issued.error,
      }));
      fulfillmentLog("warn", "LICENSE_FAILED", {
        orderId,
        productId,
        appId: item.appId,
        code: issued.error,
      });
      return;
    }

    if (issued.license.status !== "SOLD" && issued.license.status !== "ACTIVATED") {
      const code: LicenseErrorCode = "RXW_CORE_INVALID_RESPONSE";
      await this.dependencies.operations.fail(claim.operation, code);
      await this.updateItem(orderId, productId, (current) => ({
        ...current,
        licenseStatus: "failed",
        licenseError: code,
      }));
      return;
    }

    const completed = await this.dependencies.operations.complete(
      claim.operation,
      issued.license.licenseKey,
      issued.license.issuedAt,
    );
    await this.projectIssued(
      orderId,
      productId,
      issued.license.licenseKey,
      issued.license.issuedAt,
      availableDownload?.file ?? null,
    );
    fulfillmentLog("info", "LICENSE_ISSUED", {
      orderId,
      productId,
      appId: item.appId,
      replayed: issued.license.replayed,
      attempt: completed.attemptCount,
    });
  }

  private async projectIssued(
    orderId: string,
    productId: string,
    licenseKey: string,
    issuedAt: string,
    downloadFile: OrderItem["downloadFile"],
  ): Promise<void> {
    await this.updateItem(orderId, productId, (item) => ({
      ...item,
      licenseStatus: "issued",
      licenseKey,
      issuedAt,
      licenseError: null,
      downloadFile,
      downloadEnabledAt:
        downloadFile === null ? null : item.downloadEnabledAt ?? new Date().toISOString(),
    }));
    if (downloadFile !== null) {
      fulfillmentLog("info", "DOWNLOAD_READY", { orderId, productId });
    }
  }

  private async updateItem(
    orderId: string,
    productId: string,
    updater: (item: OrderItem) => OrderItem,
  ): Promise<void> {
    await this.dependencies.orders.updateAtomically(orderId, (order) => ({
      ...order,
      items: order.items.map((item) =>
        item.productId === productId ? updater(item) : item,
      ),
    }));
  }

  private async finalize(orderId: string): Promise<Order | null> {
    const updated = await this.dependencies.orders.updateAtomically(orderId, (order) => {
      const allReady = order.items.every(
        (item) => item.licenseStatus === "issued" && item.downloadFile !== null,
      );
      const anyPending = order.items.some((item) => item.licenseStatus === "pending");
      const anyIssued = order.items.some((item) => item.licenseStatus === "issued");
      const allFailed = order.items.every((item) => item.licenseStatus === "failed");
      const missingDownload = order.items.some(
        (item) => item.licenseStatus === "issued" && item.downloadFile === null,
      );
      const fulfillmentStatus = allReady
        ? "fulfilled"
        : anyPending
          ? "pending"
          : anyIssued
            ? "partial"
            : allFailed
              ? "failed"
              : "pending";
      const lastError =
        order.items.find((item) => item.licenseError !== null)?.licenseError ??
        (missingDownload ? "DOWNLOAD_NOT_CONFIGURED" : null);

      return {
        ...order,
        status: allReady ? "fulfilled" : "paid",
        licenseStatus: aggregateLicenseStatus(order.items),
        fulfillment: {
          ...order.fulfillment,
          status: fulfillmentStatus,
          completedAt: allReady ? new Date().toISOString() : null,
          lastError,
        },
      };
    });
    if (updated?.status === "fulfilled") {
      fulfillmentLog("info", "ORDER_FULFILLED", { orderId });
    }
    return updated;
  }

  private rejected(
    orderId: string,
    message: string,
    order?: Order,
  ): FulfillmentResult {
    return {
      status: "rejected",
      orderId,
      items: order === undefined ? [] : itemResults(order.items),
      message,
    };
  }
}

export function createFulfillmentService(
  licenses: LicenseProvider = getLicenseProvider(),
): FulfillmentService {
  return new FulfillmentService({
    orders: getOrderRepository(),
    payments: getPaymentRepository(),
    operations: getFulfillmentRepository(),
    downloads: getProductDownloadRepository(),
    licenses,
  });
}
