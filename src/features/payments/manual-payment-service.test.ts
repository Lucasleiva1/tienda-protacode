import assert from "node:assert/strict";
import test from "node:test";
import { authorizeDownload } from "@/features/downloads/download-authorization";
import { claimFreeLicenseOrder } from "@/features/orders/free-order-service";
import { getOrderStage } from "@/features/payments/manual-payment-state";
import {
  inspectPaymentProofBytes,
  PAYMENT_PROOF_MAX_BYTES,
} from "@/features/payments/payment-proof-storage";
import { sanitizeRejectionReason } from "@/features/payments/manual-payment-service";
import type { LicenseProvider } from "@/lib/licensing/license-provider";
import { createMockLicenseProvider } from "@/lib/licensing/mock-license-provider";
import {
  createTestWorld,
  pdfBytes,
  pngBytes,
  testProduct,
} from "@/test-support/world";
import type { CustomerAccount } from "@/types/customer-account";
import type { IssueLicenseInput, IssueLicenseResult } from "@/types/license";

type World = ReturnType<typeof createTestWorld>;

async function pendingOrder(world: World, product = testProduct()) {
  await world.addProduct(product);
  const created = await world.createOrder({ slugs: [product.slug] });
  if (!created.ok) throw new Error(created.message);
  return created;
}

async function orderWithMethod(world: World, product = testProduct()) {
  const created = await pendingOrder(world, product);
  const selected = await world.manual.selectMethod(created.order.id, "prex");
  assert.equal(selected.ok, true);
  return created;
}

function upload(bytes: Uint8Array) {
  const inspected = inspectPaymentProofBytes(bytes);
  if (!inspected.ok) throw new Error(inspected.message);
  return inspected.upload;
}

function download(world: World, orderId: string, productId: string, purchaseToken: string) {
  return authorizeDownload(
    { orderId, productId, purchaseToken },
    { orders: world.orders, access: world.access },
  );
}

test("A) flujo completo: pedido, Ya pagué, confirmación, licencia y descarga", async () => {
  const world = createTestWorld();
  const created = await orderWithMethod(world);
  const id = created.order.id;
  const productId = created.order.items[0]!.productId;

  assert.match(created.order.reference ?? "", /^PC-\d{4,}$/);
  assert.equal(getOrderStage((await world.orders.findById(id))!), "awaiting_payment");

  const reported = await world.manual.reportPayment(id, upload(pngBytes()));
  assert.equal(reported.ok, true);
  let order = (await world.orders.findById(id))!;
  assert.equal(order.manualPayment?.status, "awaiting_verification");
  assert.ok(order.manualPayment?.reportedAt);
  assert.ok(order.manualPayment?.proof);
  // "Ya pagué" nunca aprueba: el pedido sigue sin pagar.
  assert.equal(order.status, "pending");
  assert.equal(order.payment.status, "not_started");
  assert.equal(world.licenses.calls(), 0);

  // G) antes de confirmar, la descarga está bloqueada aunque el token sea válido.
  const early = await download(world, id, productId, created.purchaseToken);
  assert.equal(early.ok, false);
  if (!early.ok) assert.equal(early.code, "NOT_READY");

  const confirmed = await world.manual.confirmPayment(id, "admin@example.test");
  assert.equal(confirmed.ok, true);
  if (confirmed.ok) assert.equal(confirmed.duplicate, false);

  order = (await world.orders.findById(id))!;
  assert.equal(order.status, "fulfilled");
  assert.equal(getOrderStage(order), "completed");
  assert.equal(order.manualPayment?.status, "paid");
  assert.equal(order.manualPayment?.approvedBy, "admin@example.test");
  assert.ok(order.manualPayment?.paidAt);
  assert.equal(order.payment.status, "approved");
  assert.equal(order.payment.provider, "manual:prex");
  assert.equal(order.items[0]?.licenseStatus, "issued");
  assert.match(order.items[0]?.licenseKey ?? "", /^MOCK-DEV-/);
  assert.ok(order.items[0]?.licenseId);
  assert.ok(order.fulfillment.licenseAssignedAt);
  assert.equal((await world.payments.findByOrderId(id))?.status, "approved");
  assert.equal(world.licenses.calls(), 1);

  const allowed = await download(world, id, productId, created.purchaseToken);
  assert.equal(allowed.ok, true);

  // L) aviso push al Admin y email de entrega con la licencia y el enlace privado.
  assert.equal(world.emails.length, 1);
  const email = world.emails[0]!;
  assert.equal(email.to, "ada@example.test");
  assert.match(email.subject, /está lista/);
  assert.ok(email.text.includes(order.items[0]!.licenseKey!));
  assert.match(email.text, /https:\/\/tienda\.example\/compras\//);
  assert.equal(order.notifications.deliveryReadyEmailAt !== null, true);
});

test("el enlace del email funciona junto con el enlace original", async () => {
  const world = createTestWorld();
  const created = await orderWithMethod(world);
  await world.manual.reportPayment(created.order.id);
  await world.manual.confirmPayment(created.order.id, "admin");
  const link = /\/compras\/([A-Za-z0-9_-]{43})/.exec(world.emails[0]!.text)?.[1];
  assert.ok(link);
  const productId = created.order.items[0]!.productId;
  assert.equal((await download(world, created.order.id, productId, link)).ok, true);
  assert.equal((await download(world, created.order.id, productId, created.purchaseToken)).ok, true);
});

test("B) Ya pagué dos veces (seguidas o simultáneas) avisa una sola vez", async () => {
  const world = createTestWorld();
  const created = await orderWithMethod(world);
  await world.subscriptions.save(
    {
      endpoint: "https://fcm.googleapis.com/fcm/send/dispositivo-1",
      keys: { p256dh: Buffer.alloc(65, 4).toString("base64url"), auth: Buffer.alloc(16, 1).toString("base64url") },
    },
    "Android",
  );

  const results = await Promise.all([
    world.manual.reportPayment(created.order.id),
    world.manual.reportPayment(created.order.id),
  ]);
  const again = await world.manual.reportPayment(created.order.id);

  assert.equal(results.every((result) => result.ok), true);
  const changed = results.filter((result) => result.ok && result.changed).length;
  assert.equal(changed, 1);
  assert.equal(again.ok && again.changed, false);
  assert.equal(world.pushes.length, 1);
  assert.equal((await world.orders.findById(created.order.id))?.manualPayment?.status, "awaiting_verification");
});

test("C) confirmar dos veces seguidas no genera otra licencia ni otro email", async () => {
  const world = createTestWorld();
  const created = await orderWithMethod(world);
  await world.manual.reportPayment(created.order.id);

  const first = await world.manual.confirmPayment(created.order.id, "admin");
  const firstKey = (await world.orders.findById(created.order.id))?.items[0]?.licenseKey;
  const second = await world.manual.confirmPayment(created.order.id, "admin");

  assert.equal(first.ok && !first.duplicate, true);
  assert.equal(second.ok && second.duplicate, true);
  assert.equal(world.licenses.calls(), 1);
  assert.equal((await world.orders.findById(created.order.id))?.items[0]?.licenseKey, firstKey);
  assert.equal(world.emails.length, 1);
});

test("D) confirmaciones simultáneas: una sola transición, una licencia, un registro de pago", async () => {
  const world = createTestWorld();
  const created = await orderWithMethod(world);
  await world.manual.reportPayment(created.order.id);

  const results = await Promise.all(
    Array.from({ length: 4 }, () => world.manual.confirmPayment(created.order.id, "admin")),
  );

  assert.equal(results.every((result) => result.ok), true);
  assert.equal(results.filter((result) => result.ok && !result.duplicate).length, 1);
  assert.equal(world.licenses.calls(), 1);
  const order = (await world.orders.findById(created.order.id))!;
  assert.equal(order.status, "fulfilled");
  assert.equal(order.items.length, 1);
  assert.equal(world.emails.length, 1);
  assert.equal((await world.payments.findByOrderId(created.order.id))?.status, "approved");
});

test("D) una confirmación cortada a mitad se completa al repetirla, sin duplicar", async () => {
  let failDelivery = true;
  const world = createTestWorld();
  const created = await orderWithMethod(world);
  const original = world.delivery.deliver;
  world.delivery.deliver = async (orderId: string) => {
    if (failDelivery) {
      failDelivery = false;
      throw new Error("FUNCTION_TIMEOUT");
    }
    return original(orderId);
  };

  const first = await world.manual.confirmPayment(created.order.id, "admin");
  assert.equal(first.ok, true);
  let order = (await world.orders.findById(created.order.id))!;
  assert.equal(order.status, "paid");
  assert.equal(order.items[0]?.licenseStatus, "not_requested");

  const repeated = await world.manual.confirmPayment(created.order.id, "admin");
  assert.equal(repeated.ok && repeated.duplicate, true);
  order = (await world.orders.findById(created.order.id))!;
  assert.equal(order.status, "fulfilled");
  assert.equal(world.licenses.calls(), 1);
});

test("E) el precio sale del servidor aunque el navegador mande otro importe", async () => {
  const world = createTestWorld();
  const product = await world.addProduct(testProduct());
  const tampered = {
    slugs: [product.slug],
    amount: 1,
    price: { amount: 1, currency: "ARS" },
    total: { amount: 1, currency: "ARS" },
    status: "paid",
    productName: "Otro nombre",
  } as unknown as { slugs: string[] };
  const created = await world.createOrder(tampered);
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.order.total.amount, 1_500_000);
  assert.equal(created.order.items[0]?.name, "Biblioteca Visual");
  assert.equal(created.order.status, "pending");

  // Un cambio de precio posterior no altera el pedido congelado.
  world.products.set(product.slug, { ...product, price: { ...product.price, ARS: { amount: 99, currency: "ARS" } } });
  assert.equal((await world.orders.findById(created.order.id))?.total.amount, 1_500_000);
});

test("E) un programa pago con precio 0 no genera pedido", async () => {
  const world = createTestWorld();
  const product = await world.addProduct(
    testProduct({ price: { ARS: { amount: 0, currency: "ARS" }, USD: { amount: 0, currency: "USD" } } }),
  );
  const created = await world.createOrder({ slugs: [product.slug] });
  assert.equal(created.ok, false);
  if (!created.ok) assert.equal(created.problem, "invalid_total");
});

test("F) el token de un pedido no abre ni descarga otro", async () => {
  const world = createTestWorld();
  const first = await orderWithMethod(world);
  const second = await world.createOrder({ slugs: ["biblioteca"] });
  if (!second.ok) throw new Error("second");
  await world.manual.reportPayment(second.order.id);
  await world.manual.confirmPayment(second.order.id, "admin");

  const cross = await download(world, second.order.id, second.order.items[0]!.productId, first.purchaseToken);
  assert.equal(cross.ok, false);
  if (!cross.ok) assert.equal(cross.code, "NOT_FOUND");
  assert.notEqual(first.order.reference, second.order.reference);
});

test("H) pedido rechazado: no se puede confirmar, informar ni descargar", async () => {
  const world = createTestWorld();
  const created = await orderWithMethod(world);
  await world.manual.reportPayment(created.order.id);

  const rejected = await world.manual.rejectPayment(created.order.id, "admin", "  No encontramos\n la transferencia ");
  assert.equal(rejected.ok, true);
  const order = (await world.orders.findById(created.order.id))!;
  assert.equal(order.status, "failed");
  assert.equal(getOrderStage(order), "rejected");
  assert.equal(order.manualPayment?.rejectionReason, "No encontramos la transferencia");

  const confirm = await world.manual.confirmPayment(created.order.id, "admin");
  assert.equal(confirm.ok, false);
  if (!confirm.ok) assert.equal(confirm.code, "PAYMENT_REJECTED");

  const report = await world.manual.reportPayment(created.order.id);
  assert.equal(report.ok, false);

  const again = await world.manual.rejectPayment(created.order.id, "admin", null);
  assert.equal(again.ok && again.duplicate, true);
  assert.equal(world.licenses.calls(), 0);
  const blocked = await download(world, created.order.id, created.order.items[0]!.productId, created.purchaseToken);
  assert.equal(blocked.ok, false);
});

test("un pago confirmado ya no se puede rechazar", async () => {
  const world = createTestWorld();
  const created = await orderWithMethod(world);
  await world.manual.confirmPayment(created.order.id, "admin");
  const rejected = await world.manual.rejectPayment(created.order.id, "admin", "error");
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.code, "PAYMENT_ALREADY_PAID");
});

function account(overrides: Partial<CustomerAccount> = {}): CustomerAccount {
  return {
    id: "7f6d4b8a-1111-4111-8111-111111111111",
    email: "lucas@example.test",
    firstName: "Lucas",
    lastName: "Prueba",
    passwordHash: null,
    googleSubject: "google-sub-1",
    emailVerified: true,
    avatarUrl: null,
    sessionVersion: 0,
    createdAt: "2026-09-16T12:00:00.000Z",
    updatedAt: "2026-09-16T12:00:00.000Z",
    ...overrides,
  };
}

test("I) producto gratuito con licencia: sin pago, una sola licencia por cuenta", async () => {
  const world = createTestWorld();
  const product = await world.addProduct(
    testProduct({ id: "3d08bc3b-0000-4000-8000-000000000009", slug: "gratis", appId: "gratis-app", pricingType: "free" }),
  );
  const dependencies = {
    orders: world.orders,
    payments: world.payments,
    access: world.access,
    references: world.references,
    delivery: world.delivery,
    notifications: world.notifications,
  };

  const [first, second] = await Promise.all([
    claimFreeLicenseOrder({ account: account(), product }, dependencies),
    claimFreeLicenseOrder({ account: account(), product }, dependencies),
  ]);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.equal(first.order.id, second.order.id);
  assert.equal([first.created, second.created].filter(Boolean).length, 1);

  const order = (await world.orders.findById(first.order.id))!;
  assert.equal(order.total.amount, 0);
  assert.equal(order.status, "fulfilled");
  assert.equal(order.payment.provider, "free");
  assert.equal(order.customer.accountId, account().id);
  assert.equal(world.licenses.calls(), 1);

  // Un gratuito nunca entra al flujo de pago.
  const paid = await world.createOrder({ slugs: [product.slug] });
  assert.equal(paid.ok, false);
  if (!paid.ok) assert.equal(paid.problem, "free_product");

  // Sin licencia requerida no corresponde este flujo (se descarga directo).
  const direct = await claimFreeLicenseOrder(
    { account: account(), product: { ...product, licenseRequired: false } },
    dependencies,
  );
  assert.equal(direct.ok, false);
});

test("J) producto sin licencia: se confirma y se entrega solo la descarga", async () => {
  const world = createTestWorld();
  const created = await orderWithMethod(world, testProduct({ licenseRequired: false }));
  await world.manual.reportPayment(created.order.id);
  await world.manual.confirmPayment(created.order.id, "admin");

  const order = (await world.orders.findById(created.order.id))!;
  assert.equal(order.status, "fulfilled");
  assert.equal(order.items[0]?.licenseStatus, "not_required");
  assert.equal(order.items[0]?.licenseKey, null);
  assert.equal(order.licenseStatus, "not_required");
  assert.equal(world.licenses.calls(), 0);
  const allowed = await download(world, order.id, order.items[0]!.productId, created.purchaseToken);
  assert.equal(allowed.ok, true);
  assert.doesNotMatch(world.emails[0]!.text, /Licencia:/);
});

test("K) si falla la licencia el pago queda confirmado y el reintento no reconfirma", async () => {
  const base = createMockLicenseProvider("test");
  let fail = true;
  const flaky: LicenseProvider = {
    name: "FlakyProvider",
    enabled: true,
    async issueLicense(input: IssueLicenseInput): Promise<IssueLicenseResult> {
      if (fail) {
        fail = false;
        return { ok: false, error: "LICENSE_API_UNAVAILABLE", message: "Servidor caído" };
      }
      return base.issueLicense(input);
    },
  };
  const world = createTestWorld({ licenses: flaky });
  const created = await orderWithMethod(world);
  await world.manual.reportPayment(created.order.id);
  await world.manual.confirmPayment(created.order.id, "admin");

  let order = (await world.orders.findById(created.order.id))!;
  const paidAt = order.manualPayment?.paidAt;
  const approvedAt = (await world.payments.findByOrderId(order.id))?.approvedAt;
  assert.equal(order.status, "paid");
  assert.equal(getOrderStage(order), "paid");
  assert.equal(order.manualPayment?.status, "paid");
  assert.equal(order.items[0]?.licenseStatus, "failed");
  assert.equal(order.items[0]?.licenseError, "LICENSE_API_UNAVAILABLE");
  assert.equal(order.fulfillment.lastError, "LICENSE_API_UNAVAILABLE");
  // Aviso de pago aprobado, todavía sin licencia.
  assert.equal(world.emails.length, 1);
  assert.match(world.emails[0]!.subject, /Pago aprobado/);
  const blocked = await download(world, order.id, order.items[0]!.productId, created.purchaseToken);
  assert.equal(blocked.ok, false);

  const retried = await world.manual.retryDelivery(order.id);
  assert.equal(retried.ok, true);
  order = (await world.orders.findById(created.order.id))!;
  assert.equal(order.status, "fulfilled");
  assert.equal(order.items[0]?.licenseStatus, "issued");
  assert.equal(order.manualPayment?.paidAt, paidAt);
  assert.equal((await world.payments.findByOrderId(order.id))?.approvedAt, approvedAt);
  assert.equal(world.licenses.calls(), 2);
  assert.equal(world.emails.length, 2);
  assert.match(world.emails[1]!.subject, /está lista/);
});

test("medios: solo se elige uno activo, y el pago no se informa sin medio", async () => {
  const world = createTestWorld();
  const created = await pendingOrder(world);

  const withoutMethod = await world.manual.reportPayment(created.order.id);
  assert.equal(withoutMethod.ok, false);
  if (!withoutMethod.ok) assert.equal(withoutMethod.code, "METHOD_REQUIRED");

  const inactive = await world.manual.selectMethod(created.order.id, "uala");
  assert.equal(inactive.ok, false);
  if (!inactive.ok) assert.equal(inactive.code, "METHOD_UNAVAILABLE");

  assert.equal((await world.manual.selectMethod(created.order.id, "whatsapp")).ok, true);
  assert.equal((await world.manual.selectMethod(created.order.id, "prex")).ok, true);
  await world.manual.reportPayment(created.order.id);
  const change = await world.manual.selectMethod(created.order.id, "whatsapp");
  assert.equal(change.ok, false);
  if (!change.ok) assert.equal(change.code, "PAYMENT_ALREADY_REPORTED");
  assert.equal((await world.orders.findById(created.order.id))?.manualPayment?.methodLabel, "Prex");
});

test("comprobante: formatos y tamaño controlados, y reemplazarlo borra el anterior", async () => {
  assert.equal(inspectPaymentProofBytes(pngBytes()).ok, true);
  assert.equal(inspectPaymentProofBytes(pdfBytes()).ok, true);
  assert.equal(inspectPaymentProofBytes(new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03])).ok, false);
  assert.equal(inspectPaymentProofBytes(new Uint8Array()).ok, false);
  const big = new Uint8Array(PAYMENT_PROOF_MAX_BYTES + 1);
  big.set(pngBytes());
  assert.equal(inspectPaymentProofBytes(big).ok, false);

  const world = createTestWorld();
  const created = await orderWithMethod(world);
  await world.manual.reportPayment(created.order.id, upload(pngBytes()));
  const firstKey = (await world.orders.findById(created.order.id))?.manualPayment?.proof?.storageKey;
  assert.ok(firstKey);
  assert.equal(world.stores.proofs.has(firstKey), true);

  const replaced = await world.manual.attachProof(created.order.id, upload(pdfBytes()));
  assert.equal(replaced.ok, true);
  const order = (await world.orders.findById(created.order.id))!;
  assert.equal(order.manualPayment?.proof?.contentType, "application/pdf");
  assert.equal(world.stores.proofs.has(firstKey), false);
  // El comprobante nunca cambia el estado del pago.
  assert.equal(order.manualPayment?.status, "awaiting_verification");
  assert.equal(order.status, "pending");
});

test("un comprobante sobre un pedido cerrado no queda guardado", async () => {
  const world = createTestWorld();
  const created = await orderWithMethod(world);
  await world.manual.confirmPayment(created.order.id, "admin");
  const late = await world.manual.attachProof(created.order.id, upload(pngBytes()));
  assert.equal(late.ok, false);
  assert.equal((await world.stores.proofs.keys()).length, 0);
});

test("el motivo de rechazo se limpia", () => {
  assert.equal(sanitizeRejectionReason("  a b \n c  "), "a b c");
  assert.equal(sanitizeRejectionReason("   "), null);
  assert.equal(sanitizeRejectionReason("x".repeat(400))?.length, 300);
});
