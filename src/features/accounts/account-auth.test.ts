import assert from "node:assert/strict";
import test from "node:test";
import { normalizeCustomerEmail } from "@/features/accounts/account-service";
import { safeNextPath } from "@/features/accounts/auth-utils";
import { hashPassword, verifyPassword } from "@/features/admin/password";
import { isVerificationToken } from "@/features/accounts/email-verification";
import { googleAuthOrigin } from "@/features/accounts/google-auth";

test("normaliza el correo de una cuenta", () => {
  assert.equal(normalizeCustomerEmail("  Cliente@Ejemplo.COM "), "cliente@ejemplo.com");
});

test("solo permite retornos internos después del login", () => {
  assert.equal(safeNextPath("/checkout"), "/checkout");
  assert.equal(safeNextPath("//sitio-externo.example"), "/cuenta");
  assert.equal(safeNextPath("https://sitio-externo.example"), "/cuenta");
});

test("las contraseñas se guardan con scrypt y se verifican en tiempo seguro", async () => {
  const hash = await hashPassword("Clave-segura-2026");
  assert.notEqual(hash, "Clave-segura-2026");
  assert.equal(await verifyPassword("Clave-segura-2026", hash), true);
  assert.equal(await verifyPassword("Otra-clave-2026", hash), false);
});

test("acepta únicamente el formato de los tokens de confirmación", () => {
  assert.equal(isVerificationToken("a".repeat(43)), true);
  assert.equal(isVerificationToken("a".repeat(42)), false);
  assert.equal(isVerificationToken(`${"a".repeat(42)}!`), false);
});

test("Google usa un origen configurado y no confía en un Host arbitrario", () => {
  const previous = process.env.PUBLIC_SITE_URL;
  process.env.PUBLIC_SITE_URL = "https://tienda.example/ruta-ignorada";
  assert.equal(googleAuthOrigin("https://host-inyectado.example"), "https://tienda.example");
  if (previous === undefined) delete process.env.PUBLIC_SITE_URL;
  else process.env.PUBLIC_SITE_URL = previous;
});
