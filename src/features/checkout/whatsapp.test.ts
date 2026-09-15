import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWhatsAppCheckoutUrl,
  buildWhatsAppMessage,
  normalizeWhatsAppNumber,
} from "@/features/checkout/whatsapp";
import type { Order } from "@/types/order";

function order(): Order {
  return {
    id: "12345678-1234-4234-8234-123456789abc",
    status: "pending",
    customer: { firstName: "Ada", lastName: "Lovelace", email: "ada@example.test" },
    items: [
      {
        productId: "product-1",
        slug: "programa",
        appId: "programa-app",
        name: "Programa Uno",
        version: "1.2.0",
        platforms: ["windows"],
        downloadType: "installer",
        unitPrice: { amount: 2490000, currency: "ARS" },
        quantity: 1,
        licenseStatus: "not_requested",
        licenseKey: null,
        issuedAt: null,
        licenseError: null,
        downloadFile: null,
        downloadEnabledAt: null,
      },
    ],
    currency: "ARS",
    subtotal: { amount: 2490000, currency: "ARS" },
    total: { amount: 2490000, currency: "ARS" },
    payment: {
      paymentId: null,
      status: "not_started",
      provider: "whatsapp",
      providerReference: null,
    },
    licenseStatus: "not_requested",
    fulfillment: {
      status: "not_started",
      lastAttemptAt: null,
      completedAt: null,
      lastError: null,
    },
    purchaseAccess: null,
    createdAt: "2026-09-14T12:00:00.000Z",
    updatedAt: "2026-09-14T12:00:00.000Z",
  };
}

test("normaliza un número internacional para wa.me", () => {
  assert.equal(normalizeWhatsAppNumber("+54 9 11 2345-6789"), "5491123456789");
  assert.equal(normalizeWhatsAppNumber("123"), null);
  assert.equal(normalizeWhatsAppNumber(undefined), null);
});

test("el mensaje contiene la referencia, el producto y el total, pero no el email", () => {
  const message = buildWhatsAppMessage(order());

  assert.match(message, /Pedido: 12345678/);
  assert.match(message, /Programa Uno v1\.2\.0/);
  assert.match(message, /24\.900,00/);
  assert.doesNotMatch(message, /ada@example\.test/);
});

test("genera un enlace oficial de WhatsApp con el mensaje codificado", () => {
  const url = new URL(buildWhatsAppCheckoutUrl(order(), "5491123456789"));

  assert.equal(url.origin, "https://wa.me");
  assert.equal(url.pathname, "/5491123456789");
  assert.match(url.searchParams.get("text") ?? "", /Pedido: 12345678/);
});
