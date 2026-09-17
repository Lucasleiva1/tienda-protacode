import assert from "node:assert/strict";
import test from "node:test";
import type { ProductDownloadRepository } from "@/features/downloads/product-download-repository";
import { authorizeDownload } from "@/features/downloads/download-authorization";
import { createFulfillmentRepository } from "@/features/fulfillment/fulfillment-repository";
import { FulfillmentService } from "@/features/fulfillment/fulfillment-service";
import type { OrderRepository } from "@/features/orders/order-repository";
import type { PaymentRepository } from "@/features/payments/payment-repository";
import {
  createPurchaseAccess,
  findOrderByPurchaseToken,
} from "@/features/purchases/purchase-access";
import type { PurchaseAccessRepository } from "@/features/purchases/purchase-access-repository";
import type { KeyValueStore } from "@/lib/storage/store";
import { createDisabledLicenseProvider } from "@/lib/licensing/disabled-license-provider";
import type { LicenseProvider } from "@/lib/licensing/license-provider";
import { createMockLicenseProvider } from "@/lib/licensing/mock-license-provider";
import { createRxwCoreLicenseProvider } from "@/lib/licensing/rxw-core-license-provider";
import type { DownloadFileReference, ProductDownload } from "@/types/download";
import type { IssueLicenseInput, IssueLicenseResult } from "@/types/license";
import type { Order, OrderItem } from "@/types/order";
import type { Payment } from "@/types/payment";

const ISSUED_AT = "2026-08-29T12:00:00.000Z";

class MemoryStore implements KeyValueStore {
  readonly engine = "MemoryStore";
  private readonly values = new Map<string, unknown>();
  private readonly versions = new Map<string, number>();

  async get<T>(key: string) { return (this.values.get(key) as T | undefined) ?? null; }
  async set<T>(key: string, value: T) {
    this.values.set(key, structuredClone(value));
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
  }
  async setIfAbsent<T>(key: string, value: T) {
    if (this.values.has(key)) return false;
    await this.set(key, value);
    return true;
  }
  async getWithVersion<T>(key: string) {
    const value = await this.get<T>(key);
    return value === null ? null : { value, version: String(this.versions.get(key) ?? 0) };
  }
  async setIfVersion<T>(key: string, value: T, version: string) {
    if (String(this.versions.get(key) ?? 0) !== version) return false;
    await this.set(key, value);
    return true;
  }
  async remove(key: string) { this.values.delete(key); this.versions.delete(key); }
  async keys() { return [...this.values.keys()]; }
}

class MemoryOrders implements OrderRepository {
  readonly name = "MemoryOrders";
  readonly values = new Map<string, Order>();

  constructor(initial: readonly Order[]) {
    for (const order of initial) this.values.set(order.id, order);
  }
  async save(order: Order) { this.values.set(order.id, order); }
  async findById(id: string) { return this.values.get(id) ?? null; }
  async update(order: Order) { this.values.set(order.id, order); }
  async updateAtomically(id: string, updater: (current: Order) => Order) {
    const current = this.values.get(id);
    if (current === undefined) return null;
    const next = updater(current);
    this.values.set(id, next);
    return next;
  }
}

class MemoryDownloads implements ProductDownloadRepository {
  readonly values = new Map<string, ProductDownload>();
  key(productId: string, version: string) { return `${productId}:${version}`; }
  async find(productId: string, version: string) {
    return this.values.get(this.key(productId, version)) ?? null;
  }
  async save(value: ProductDownload) { this.values.set(this.key(value.productId, value.version), value); }
  async remove(productId: string, version: string) { this.values.delete(this.key(productId, version)); }
}

class MemoryAccess implements PurchaseAccessRepository {
  readonly values = new Map<string, string>();
  async reserve(hash: string, orderId: string) {
    if (this.values.has(hash)) return false;
    this.values.set(hash, orderId);
    return true;
  }
  async findOrderId(hash: string) { return this.values.get(hash) ?? null; }
  async remove(hash: string) { this.values.delete(hash); }
}

function item(productId: string, appId: string): OrderItem {
  return {
    productId,
    slug: productId,
    appId,
    name: `Programa ${productId}`,
    version: "1.0.0",
    platforms: ["windows"],
    downloadType: "installer",
    unitPrice: { amount: 10000, currency: "ARS" },
    quantity: 1,
    licenseRequired: true,
    licenseStatus: "not_requested",
    licenseKey: null,
    licenseId: null,
    issuedAt: null,
    licenseError: null,
    downloadFile: null,
    downloadEnabledAt: null,
  };
}

function order(items: readonly OrderItem[], status: Order["status"] = "paid"): Order {
  const now = new Date().toISOString();
  const amount = items.reduce((total, value) => total + value.unitPrice.amount, 0);
  return {
    id: crypto.randomUUID(),
    status,
    customer: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.test" },
    items,
    currency: "ARS",
    subtotal: { amount, currency: "ARS" },
    total: { amount, currency: "ARS" },
    payment: {
      paymentId: `pay-test`,
      status: status === "pending" ? "pending" : "approved",
      provider: "test",
      providerReference: "external-test",
    },
    licenseStatus: "not_requested",
    fulfillment: {
      status: "not_started",
      lastAttemptAt: null,
      completedAt: null,
      lastError: null,
      licenseAssignedAt: null,
    },
    reference: null,
    manualPayment: null,
    purchaseAccess: null,
    notifications: { paymentApprovedEmailAt: null, deliveryReadyEmailAt: null },
    createdAt: now,
    updatedAt: now,
  };
}

function paymentFor(value: Order): Payment {
  return {
    id: `pay-${value.id}`,
    orderId: value.id,
    provider: "test",
    externalPaymentId: "external-test",
    status: value.payment.status,
    amount: value.total,
    checkoutUrl: null,
    idempotencyKey: `payment:${value.id}`,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    approvedAt: value.payment.status === "approved" ? value.updatedAt : null,
    failureReason: null,
  };
}

function paymentRepository(value: Order): PaymentRepository {
  const payment = paymentFor(value);
  return {
    findByOrderId: async (orderId: string) => orderId === value.id ? payment : null,
  } as PaymentRepository;
}

function downloadFor(value: OrderItem): ProductDownload {
  return {
    productId: value.productId,
    version: value.version,
    file: {
      storageKey: `products/${value.productId}/${value.version}/programa-v${value.version}.zip`,
      fileName: `programa-v${value.version}.zip`,
      contentType: "application/zip",
      size: 1024,
      sha256: "a".repeat(64),
      uploadedAt: ISSUED_AT,
    },
    updatedAt: ISSUED_AT,
  };
}

function setup(value: Order, provider: LicenseProvider) {
  const orders = new MemoryOrders([value]);
  const downloads = new MemoryDownloads();
  const operations = createFulfillmentRepository(new MemoryStore());
  const service = new FulfillmentService({
    orders,
    payments: paymentRepository(value),
    operations,
    downloads,
    licenses: provider,
  });
  return { orders, downloads, operations, service };
}

test("pedido pending rechaza fulfillment", async () => {
  const value = order([item("product-1", "app-1")], "pending");
  const context = setup(value, createDisabledLicenseProvider());
  const result = await context.service.fulfill(value.id);
  assert.equal(result.status, "rejected");
  assert.equal((await context.orders.findById(value.id))?.licenseStatus, "not_requested");
});

test("RXW no configurado deja Order paid, licencia failed y no crea clave falsa", async () => {
  const value = order([item("product-1", "app-1")]);
  const context = setup(value, createDisabledLicenseProvider());
  const result = await context.service.fulfill(value.id);
  const stored = await context.orders.findById(value.id);
  assert.equal(result.status, "failed");
  assert.equal(stored?.status, "paid");
  assert.equal(stored?.items[0]?.licenseStatus, "failed");
  assert.equal(stored?.items[0]?.licenseError, "RXW_CORE_NOT_CONFIGURED");
  assert.equal(stored?.items[0]?.licenseKey, null);
});

test("mock development emite, autoriza descarga, fulfilled e idempotencia", async () => {
  const value = order([item("product-1", "app-1")]);
  const base = createMockLicenseProvider("test");
  let calls = 0;
  const provider: LicenseProvider = {
    ...base,
    async issueLicense(input) { calls += 1; return base.issueLicense(input); },
  };
  const context = setup(value, provider);
  await context.downloads.save(downloadFor(value.items[0]!));

  assert.equal((await context.service.fulfill(value.id)).status, "fulfilled");
  const stored = await context.orders.findById(value.id);
  assert.equal(stored?.status, "fulfilled");
  assert.equal(stored?.items[0]?.licenseStatus, "issued");
  assert.equal(stored?.items[0]?.downloadFile?.fileName, "programa-v1.0.0.zip");
  assert.equal(calls, 1);

  assert.equal((await context.service.fulfill(value.id)).status, "fulfilled");
  assert.equal(calls, 1);
});

test("dos fulfillment simultáneos no llaman dos veces al proveedor", async () => {
  const value = order([item("product-1", "app-1")]);
  const base = createMockLicenseProvider("test");
  let calls = 0;
  const provider: LicenseProvider = {
    ...base,
    async issueLicense(input) {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return base.issueLicense(input);
    },
  };
  const context = setup(value, provider);
  await context.downloads.save(downloadFor(value.items[0]!));
  await Promise.all([context.service.fulfill(value.id), context.service.fulfill(value.id)]);
  assert.equal(calls, 1);
  assert.equal((await context.orders.findById(value.id))?.status, "fulfilled");
});

test("dos productos reciben una licencia independiente", async () => {
  const value = order([item("product-a", "app-a"), item("product-b", "app-b")]);
  const context = setup(value, createMockLicenseProvider("test"));
  await Promise.all(value.items.map((entry) => context.downloads.save(downloadFor(entry))));
  await context.service.fulfill(value.id);
  const stored = await context.orders.findById(value.id);
  assert.equal(stored?.status, "fulfilled");
  assert.notEqual(stored?.items[0]?.licenseKey, stored?.items[1]?.licenseKey);
  assert.deepEqual(stored?.items.map((entry) => entry.appId), ["app-a", "app-b"]);
});

test("fallo parcial queda recuperable y retry completa solo el ítem fallido", async () => {
  const value = order([item("product-a", "app-a"), item("product-b", "app-b")]);
  const base = createMockLicenseProvider("test");
  let failedB = false;
  const calls = new Map<string, number>();
  const provider: LicenseProvider = {
    name: "FlakyProvider",
    enabled: true,
    async issueLicense(input: IssueLicenseInput): Promise<IssueLicenseResult> {
      calls.set(input.appId, (calls.get(input.appId) ?? 0) + 1);
      if (input.appId === "app-b" && !failedB) {
        failedB = true;
        return { ok: false, error: "RXW_CORE_UNAVAILABLE", message: "No disponible" };
      }
      return base.issueLicense(input);
    },
  };
  const context = setup(value, provider);
  await Promise.all(value.items.map((entry) => context.downloads.save(downloadFor(entry))));

  assert.equal((await context.service.fulfill(value.id)).status, "partial");
  assert.equal((await context.orders.findById(value.id))?.status, "paid");
  assert.equal((await context.service.fulfill(value.id)).status, "fulfilled");
  assert.equal(calls.get("app-a"), 1);
  assert.equal(calls.get("app-b"), 2);
});

test("MockLicenseProvider está bloqueado en production", () => {
  assert.throws(
    () => createMockLicenseProvider("production"),
    /MOCK_LICENSE_FORBIDDEN_IN_PRODUCTION/,
  );
});

test("adapter RXW usa el endpoint y autenticación reales", async () => {
  let requestBody: unknown = null;
  const provider = createRxwCoreLicenseProvider({
    baseUrl: "https://rxw.example.test",
    serviceId: "prota-code",
    serviceSecret: "s".repeat(32),
    environment: "production",
    fetchImplementation: async (input, init) => {
      assert.equal(String(input), "https://rxw.example.test/api/licenses/issue");
      const headers = new Headers(init?.headers);
      assert.equal(headers.get("authorization"), `Bearer ${"s".repeat(32)}`);
      assert.equal(headers.get("x-rxw-service-id"), "prota-code");
      requestBody = JSON.parse(String(init?.body));
      return Response.json({
        ok: true,
        data: {
          licenseKey: "RXW-2345-6789-ABCD-EFGH",
          appId: "app-a",
          status: "SOLD",
          orderId: "order-a",
          deliveredAt: ISSUED_AT,
          replayed: false,
          projectionPending: false,
          source: "SERVICE_API",
        },
      }, { status: 201 });
    },
  });
  const result = await provider.issueLicense({
    appId: "app-a",
    orderId: "order-a",
    customerEmail: "ada@example.test",
    idempotencyKey: "license:order-a:product-a",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(requestBody, {
    appId: "app-a",
    orderId: "order-a",
    idempotencyKey: "license:order-a:product-a",
    customerEmail: "ada@example.test",
  });
});

test("purchase token válido carga; token falso y orderId solo no conceden acceso", async () => {
  const access = createPurchaseAccess();
  const value = { ...order([item("product-1", "app-1")]), purchaseAccess: access.record };
  const orders = new MemoryOrders([value]);
  const index = new MemoryAccess();
  await index.reserve(access.record.tokenHash, value.id);
  assert.equal((await findOrderByPurchaseToken(access.token, { orders, access: index }))?.id, value.id);
  assert.equal(await findOrderByPurchaseToken("A".repeat(43), { orders, access: index }), null);
  assert.equal(await findOrderByPurchaseToken(value.id, { orders, access: index }), null);
});

test("autorización de descarga exige pago, licencia, pertenencia y token", async () => {
  const access = createPurchaseAccess();
  const baseItem = item("product-1", "app-1");
  const value = { ...order([baseItem]), purchaseAccess: access.record };
  const orders = new MemoryOrders([value]);
  const index = new MemoryAccess();
  await index.reserve(access.record.tokenHash, value.id);
  const dependencies = { orders, access: index };

  assert.equal((await authorizeDownload({ orderId: value.id, productId: baseItem.productId, purchaseToken: access.token }, dependencies)).ok, false);
  assert.equal((await authorizeDownload({ orderId: value.id, productId: "product-other", purchaseToken: access.token }, dependencies)).ok, false);
  assert.equal((await authorizeDownload({ orderId: value.id, productId: baseItem.productId, purchaseToken: "A".repeat(43) }, dependencies)).ok, false);

  const file: DownloadFileReference = downloadFor(baseItem).file;
  const delivered: Order = {
    ...value,
    status: "fulfilled",
    licenseStatus: "issued",
    fulfillment: {
      status: "fulfilled",
      lastAttemptAt: ISSUED_AT,
      completedAt: ISSUED_AT,
      lastError: null,
      licenseAssignedAt: ISSUED_AT,
    },
    items: [{
      ...baseItem,
      licenseStatus: "issued",
      licenseKey: "MOCK-DEV-APPXXX-0001",
      issuedAt: ISSUED_AT,
      downloadFile: file,
      downloadEnabledAt: ISSUED_AT,
    }],
  };
  await orders.update(delivered);
  const authorized = await authorizeDownload({
    orderId: value.id,
    productId: baseItem.productId,
    purchaseToken: access.token,
  }, dependencies);
  assert.equal(authorized.ok, true);
  if (authorized.ok) assert.equal(authorized.file.storageKey, file.storageKey);
});
