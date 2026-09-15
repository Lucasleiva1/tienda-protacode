"use server";

import { redirect } from "next/navigation";
import {
  authenticateCustomer,
  normalizeCustomerEmail,
  registerCustomer,
} from "@/features/accounts/account-service";
import {
  createCustomerSession,
  destroyCustomerSession,
  getCurrentCustomerAccount,
} from "@/features/accounts/customer-session";
import {
  consumeEmailVerification,
  issueEmailVerification,
} from "@/features/accounts/email-verification";
import { sendVerificationEmail } from "@/lib/email/verification-email";
import { allowPersistentRequest } from "@/lib/security/persistent-rate-limit";
import { safeNextPath } from "@/features/accounts/auth-utils";

export interface CustomerAuthState {
  readonly message: string;
  readonly errors?: Partial<
    Record<"firstName" | "lastName" | "email" | "password" | "confirmPassword", string>
  >;
}

export interface EmailVerificationState {
  readonly ok: boolean;
  readonly message: string;
}

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

function cleanName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export async function registerCustomerAction(
  _previous: CustomerAuthState | undefined,
  formData: FormData,
): Promise<CustomerAuthState | undefined> {
  const firstName = cleanName(String(formData.get("firstName") ?? ""));
  const lastName = cleanName(String(formData.get("lastName") ?? ""));
  const email = normalizeCustomerEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const errors: NonNullable<CustomerAuthState["errors"]> = {};

  if (firstName.length < 2 || firstName.length > 60) errors.firstName = "Revisá tu nombre.";
  if (lastName.length < 2 || lastName.length > 60) errors.lastName = "Revisá tu apellido.";
  if (email.length > 254 || !EMAIL.test(email)) errors.email = "Ingresá un email válido.";
  if (
    password.length < 10 ||
    password.length > 128 ||
    !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) ||
    !/\d/.test(password)
  ) {
    errors.password = "Usá entre 10 y 128 caracteres, con letras y números.";
  }
  if (confirmPassword !== password) errors.confirmPassword = "Las contraseñas no coinciden.";

  if (Object.keys(errors).length > 0) return { message: "Revisá los datos marcados.", errors };
  if (!(await allowPersistentRequest("customer-register", email, 5, 15 * 60_000))) {
    return { message: "Demasiados intentos. Esperá unos minutos antes de volver a probar." };
  }

  const account = await registerCustomer({ email, firstName, lastName, password });
  if (account === null) {
    return { message: "No pudimos crear la cuenta. Probá iniciar sesión o usá otro email." };
  }
  if (!(await createCustomerSession(account.id))) {
    return { message: "La sesión de clientes todavía no está configurada en el servidor." };
  }

  const token = await issueEmailVerification(account.id, account.email);
  const sent = await sendVerificationEmail(account, token);
  const next = encodeURIComponent(safeNextPath(String(formData.get("next") ?? "")));
  redirect(`/cuenta?verificacion=${sent ? "enviada" : "no-enviada"}&next=${next}`);
}

export async function loginCustomerAction(
  _previous: CustomerAuthState | undefined,
  formData: FormData,
): Promise<CustomerAuthState | undefined> {
  const email = normalizeCustomerEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (password.length > 128) return { message: "Email o contraseña incorrectos." };
  if (!(await allowPersistentRequest("customer-login", email || "empty", 8, 15 * 60_000))) {
    return { message: "Demasiados intentos. Esperá unos minutos antes de volver a probar." };
  }

  const account = await authenticateCustomer(email, password);
  if (account === null) return { message: "Email o contraseña incorrectos." };
  if (!(await createCustomerSession(account.id))) {
    return { message: "La sesión de clientes todavía no está configurada en el servidor." };
  }

  redirect(safeNextPath(String(formData.get("next") ?? "")));
}

export async function logoutCustomerAction(): Promise<void> {
  await destroyCustomerSession();
  redirect("/");
}

export async function resendVerificationAction(
  _previous: EmailVerificationState | undefined,
  _formData: FormData,
): Promise<EmailVerificationState> {
  void _previous;
  void _formData;
  const account = await getCurrentCustomerAccount();
  if (account === null) return { ok: false, message: "Iniciá sesión para continuar." };
  if (account.emailVerified) return { ok: true, message: "Tu email ya está confirmado." };
  if (!(await allowPersistentRequest("customer-verification-resend", account.id, 3, 15 * 60_000))) {
    return { ok: false, message: "Pediste varios correos. Esperá 15 minutos e intentá otra vez." };
  }

  const token = await issueEmailVerification(account.id, account.email);
  const sent = await sendVerificationEmail(account, token);
  return sent
    ? { ok: true, message: "Te enviamos un nuevo enlace. Revisá también correo no deseado." }
    : { ok: false, message: "El envío de email todavía no está configurado en el servidor." };
}

export async function confirmEmailAction(
  _previous: EmailVerificationState | undefined,
  formData: FormData,
): Promise<EmailVerificationState | undefined> {
  const token = String(formData.get("token") ?? "");
  if (!(await allowPersistentRequest("customer-verification-confirm", token || "empty", 8, 15 * 60_000))) {
    return { ok: false, message: "Demasiados intentos. Solicitá un enlace nuevo." };
  }

  const accountId = await consumeEmailVerification(token);
  if (accountId === null) {
    return { ok: false, message: "El enlace no es válido, ya fue usado o venció." };
  }
  if (!(await createCustomerSession(accountId))) {
    return { ok: false, message: "El email fue confirmado, pero no pudimos iniciar la sesión." };
  }
  redirect("/cuenta?verificacion=confirmada");
}
