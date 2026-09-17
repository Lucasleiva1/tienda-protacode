/**
 * Soporte de pruebas: la tienda completa sobre almacenes en memoria.
 *
 * Usa los repositorios REALES (con sus escrituras condicionales) sobre un
 * `KeyValueStore` en memoria que cede el control entre lecturas y escrituras. Así
 * dos operaciones "simultáneas" se intercalan de verdad y las pruebas de
 * idempotencia ejercitan el mismo código que corre en Netlify.
 */

import { createProductDownloadRepository } from "@/features/downloads/product-download-repository";
import { createFulfillmentRepository } from "@/features/fulfillment/fulfillment-repository";
import { FulfillmentService } from "@/features/fulfillment/fulfillment-service";
import { createOrderReferenceRepository } from "@/features/orders/order-reference-repository";
import { createPendingOrder, type CreateOrderInput } from "@/features/orders/order-service";
import { createPersistentOrderRepository } from "@/features/orders/persistent-order-repository";
import { NotificationService } from "@/features/notifications/notification-service";
import { createPushSubscriptionRepository } from "@/features/notifications/push-subscription-repository";
import { ManualPaymentService } from "@/features/payments/manual-payment-service";
import { createPaymentProofStorage } from "@/features/payments/payment-proof-storage";
import { createPersistentPaymentRepository } from "@/features/payments/persistent-payment-repository";
import { issueAdditionalPurchaseAccess } from "@/features/purchases/purchase-access";
import { createPurchaseAccessRepository } from "@/features/purchases/purchase-access-repository";
import { DEFAULT_PAYMENT_METHODS } from "@/features/settings/payment-method-settings";
import type { EmailMessage } from "@/lib/email/mailer";
import type { LicenseProvider } from "@/lib/licensing/license-provider";
import { createMockLicenseProvider } from "@/lib/licensing/mock-license-provider";
import type { PushSender, PushSendResult } from "@/lib/push/web-push-sender";
import type { KeyValueStore } from "@/lib/storage/store";
import type { ProductDownload } from "@/types/download";
import type { PaymentMethodSettings } from "@/types/manual-payment";
import type { Product } from "@/types/product";

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

export class MemoryStore implements KeyValueStore {
  readonly engine = "MemoryStore";
  private readonly values = new Map<string, string>();
  private readonly versions = new Map<string, number>();
  writes = 0;

  async get<T>(key: string) {
    await tick();
    const raw = this.values.get(key);
    return raw === undefined ? null : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T) {
    await tick();
    this.write(key, value);
  }

  async setIfAbsent<T>(key: string, value: T) {
    await tick();
    if (this.values.has(key)) return false;
    this.write(key, value);
    return true;
  }

  async getWithVersion<T>(key: string) {
    await tick();
    const raw = this.values.get(key);
    if (raw === undefined) return null;
    return { value: JSON.parse(raw) as T, version: String(this.versions.get(key) ?? 0) };
  }

  async setIfVersion<T>(key: string, value: T, version: string) {
    await tick();
    if (!this.values.has(key) || String(this.versions.get(key) ?? 0) !== version) return false;
    this.write(key, value);
    return true;
  }

  async remove(key: string) {
    await tick();
    this.values.delete(key);
    this.versions.delete(key);
  }

  async keys() {
    await tick();
    return [...this.values.keys()];
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  private write<T>(key: string, value: T) {
    this.writes += 1;
    this.values.set(key, JSON.stringify(value));
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
  }
}

export function testProduct(overrides: Partial<Product> = {}): Product {
  const now = "2026-09-16T12:00:00.000Z";
  return {
    id: "3d08bc3b-0000-4000-8000-000000000001",
    slug: "biblioteca",
    appId: "biblioteca-visual",
    name: "Biblioteca Visual",
    shortDescription: "Catálogo visual de archivos.",
    description: "Programa de prueba para los tests de la tienda.",
    price: {
      ARS: { amount: 1_500_000, currency: "ARS" },
      USD: { amount: 1500, currency: "USD" },
    },
    currency: "ARS",
    platforms: ["windows"],
    version: "1.0.0",
    licenseType: "perpetual",
    images: [],
    heroImage: null,
    downloadType: "installer",
    category: "utilidades",
    features: [],
    useCases: [],
    systemRequirements: [],
    licenseNote: null,
    pricingType: "paid",
    licenseRequired: true,
    acceptDonations: false,
    donationAlias: null,
    donationQr: null,
    donationAliasFont: null,
    published: true,
    featured: false,
    sortOrder: 10,
    archived: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function downloadFor(product: Product): ProductDownload {
  return {
    productId: product.id,
    version: product.version,
    file: {
      storageKey: `products/${product.id}/${product.version}/${product.slug}-v${product.version}.zip`,
      fileName: `${product.slug}-v${product.version}.zip`,
      contentType: "application/zip",
      size: 2048,
      sha256: "b".repeat(64),
      uploadedAt: "2026-09-16T12:00:00.000Z",
    },
    updatedAt: "2026-09-16T12:00:00.000Z",
  };
}

export function activeMethods(): PaymentMethodSettings[] {
  return DEFAULT_PAYMENT_METHODS.map((method) =>
    method.id === "prex"
      ? { ...method, active: true, alias: "MI.ALIAS.PREX", holder: "Prota Code" }
      : method.id === "uala"
        ? { ...method, active: false }
        : method,
  );
}

export interface CountingProvider extends LicenseProvider {
  readonly calls: () => number;
}

export function countingProvider(base: LicenseProvider = createMockLicenseProvider("test")): CountingProvider {
  let calls = 0;
  return {
    name: base.name,
    enabled: base.enabled,
    async issueLicense(input) {
      calls += 1;
      await tick();
      return base.issueLicense(input);
    },
    getLicense: base.getLicense?.bind(base),
    validateLicense: base.validateLicense?.bind(base),
    calls: () => calls,
  };
}

export interface SentPush {
  readonly endpoint: string;
  readonly payload: string;
}

/** Transporte push falso: registra lo enviado y responde según `responses`. */
export function fakePushSender(responses: Map<string, PushSendResult> = new Map()) {
  const sent: SentPush[] = [];
  const sender: PushSender = {
    ready: true,
    async send(subscription, payload) {
      sent.push({ endpoint: subscription.endpoint, payload });
      return responses.get(subscription.endpoint) ?? { ok: true };
    },
  };
  return { sender, sent };
}

export function createTestWorld(options: {
  readonly licenses?: LicenseProvider;
  readonly methods?: () => Promise<readonly PaymentMethodSettings[]>;
  readonly emailOrigin?: string | null;
} = {}) {
  const stores = {
    orders: new MemoryStore(),
    payments: new MemoryStore(),
    fulfillment: new MemoryStore(),
    access: new MemoryStore(),
    references: new MemoryStore(),
    downloads: new MemoryStore(),
    proofs: new MemoryStore(),
    push: new MemoryStore(),
  };
  const orders = createPersistentOrderRepository(stores.orders);
  const payments = createPersistentPaymentRepository(stores.payments);
  const operations = createFulfillmentRepository(stores.fulfillment);
  const access = createPurchaseAccessRepository(stores.access);
  const references = createOrderReferenceRepository(stores.references);
  const downloads = createProductDownloadRepository(stores.downloads);
  const proofs = createPaymentProofStorage(stores.proofs);
  const licenses = countingProvider(options.licenses ?? createMockLicenseProvider("test"));
  const fulfillment = new FulfillmentService({ orders, payments, operations, downloads, licenses });
  const subscriptions = createPushSubscriptionRepository(stores.push);
  const push = fakePushSender();
  const emails: EmailMessage[] = [];
  const notifications = new NotificationService({
    orders,
    subscriptions,
    push: push.sender,
    sendEmail: async (message) => {
      emails.push(message);
      return "sent";
    },
    emailOrigin: () => (options.emailOrigin === undefined ? "https://tienda.example" : options.emailOrigin),
    issueAccessLink: (orderId) => issueAdditionalPurchaseAccess(orderId, { orders, access }),
  });
  let deliveries = 0;
  const delivery = {
    async deliver(orderId: string) {
      deliveries += 1;
      return fulfillment.fulfill(orderId);
    },
  };
  const manual = new ManualPaymentService({
    orders,
    payments,
    proofs,
    methods: options.methods ?? (async () => activeMethods()),
    delivery,
    notifications,
  });
  const products = new Map<string, Product>();

  async function addProduct(product: Product, withDownload = true): Promise<Product> {
    products.set(product.slug, product);
    if (withDownload) await downloads.save(downloadFor(product));
    return product;
  }

  async function createOrder(input: Partial<CreateOrderInput> & { readonly slugs: readonly string[] }) {
    return createPendingOrder(
      {
        customer: input.customer ?? {
          accountId: null,
          firstName: "Ada",
          lastName: "Lovelace",
          email: "ada@example.test",
          whatsapp: null,
        },
        slugs: input.slugs,
        paymentMode: input.paymentMode ?? "manual",
      },
      {
        findProduct: async (slug) => products.get(slug),
        orders,
        access,
        references,
      },
    );
  }

  return {
    stores,
    orders,
    payments,
    operations,
    access,
    references,
    downloads,
    proofs,
    licenses,
    fulfillment,
    notifications,
    subscriptions,
    pushes: push.sent,
    emails,
    delivery,
    deliveries: () => deliveries,
    manual,
    products,
    addProduct,
    createOrder,
  };
}

export function pngBytes(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 73, 72, 68, 82]);
}

export function pdfBytes(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.7\n%prueba\n");
}
