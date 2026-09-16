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
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

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
  const locale = await getLocale();
  const firstName = cleanName(String(formData.get("firstName") ?? ""));
  const lastName = cleanName(String(formData.get("lastName") ?? ""));
  const email = normalizeCustomerEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const errors: NonNullable<CustomerAuthState["errors"]> = {};

  if (firstName.length < 2 || firstName.length > 60) errors.firstName = pick(locale, "Revisá tu nombre.", "Check your first name.", "Revise seu nome.");
  if (lastName.length < 2 || lastName.length > 60) errors.lastName = pick(locale, "Revisá tu apellido.", "Check your last name.", "Revise seu sobrenome.");
  if (email.length > 254 || !EMAIL.test(email)) errors.email = pick(locale, "Ingresá un email válido.", "Enter a valid email.", "Digite um e-mail válido.");
  if (
    password.length < 10 ||
    password.length > 128 ||
    !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(password) ||
    !/\d/.test(password)
  ) {
    errors.password = pick(locale, "Usá entre 10 y 128 caracteres, con letras y números.", "Use 10 to 128 characters, including letters and numbers.", "Use entre 10 e 128 caracteres, com letras e números.");
  }
  if (confirmPassword !== password) errors.confirmPassword = pick(locale, "Las contraseñas no coinciden.", "Passwords do not match.", "As senhas não coincidem.");

  if (Object.keys(errors).length > 0) return { message: pick(locale, "Revisá los datos marcados.", "Check the highlighted fields.", "Revise os campos destacados."), errors };
  if (!(await allowPersistentRequest("customer-register", email, 5, 15 * 60_000))) {
    return { message: pick(locale, "Demasiados intentos. Esperá unos minutos antes de volver a probar.", "Too many attempts. Wait a few minutes before trying again.", "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.") };
  }

  const account = await registerCustomer({ email, firstName, lastName, password });
  if (account === null) {
    return { message: pick(locale, "No pudimos crear la cuenta. Probá iniciar sesión o usá otro email.", "We could not create the account. Try signing in or use another email.", "Não foi possível criar a conta. Tente entrar ou use outro e-mail.") };
  }
  if (!(await createCustomerSession(account.id))) {
    return { message: pick(locale, "La sesión de clientes todavía no está configurada en el servidor.", "Customer sessions are not configured on the server yet.", "A sessão de clientes ainda não está configurada no servidor.") };
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
  const locale = await getLocale();
  const email = normalizeCustomerEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (password.length > 128) return { message: pick(locale, "Email o contraseña incorrectos.", "Incorrect email or password.", "E-mail ou senha incorretos.") };
  if (!(await allowPersistentRequest("customer-login", email || "empty", 8, 15 * 60_000))) {
    return { message: pick(locale, "Demasiados intentos. Esperá unos minutos antes de volver a probar.", "Too many attempts. Wait a few minutes before trying again.", "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.") };
  }

  const account = await authenticateCustomer(email, password);
  if (account === null) return { message: pick(locale, "Email o contraseña incorrectos.", "Incorrect email or password.", "E-mail ou senha incorretos.") };
  if (!(await createCustomerSession(account.id))) {
    return { message: pick(locale, "La sesión de clientes todavía no está configurada en el servidor.", "Customer sessions are not configured on the server yet.", "A sessão de clientes ainda não está configurada no servidor.") };
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
  const locale = await getLocale();
  void _previous;
  void _formData;
  const account = await getCurrentCustomerAccount();
  if (account === null) return { ok: false, message: pick(locale, "Iniciá sesión para continuar.", "Sign in to continue.", "Entre para continuar.") };
  if (account.emailVerified) return { ok: true, message: pick(locale, "Tu email ya está confirmado.", "Your email is already confirmed.", "Seu e-mail já está confirmado.") };
  if (!(await allowPersistentRequest("customer-verification-resend", account.id, 3, 15 * 60_000))) {
    return { ok: false, message: pick(locale, "Pediste varios correos. Esperá 15 minutos e intentá otra vez.", "You requested several emails. Wait 15 minutes and try again.", "Você pediu vários e-mails. Aguarde 15 minutos e tente novamente.") };
  }

  const token = await issueEmailVerification(account.id, account.email);
  const sent = await sendVerificationEmail(account, token);
  return sent
    ? { ok: true, message: pick(locale, "Te enviamos un nuevo enlace. Revisá también correo no deseado.", "We sent you a new link. Check your spam folder too.", "Enviamos um novo link. Verifique também a caixa de spam.") }
    : { ok: false, message: pick(locale, "El envío de email todavía no está configurado en el servidor.", "Email sending is not configured on the server yet.", "O envio de e-mails ainda não está configurado no servidor.") };
}

export async function confirmEmailAction(
  _previous: EmailVerificationState | undefined,
  formData: FormData,
): Promise<EmailVerificationState | undefined> {
  const locale = await getLocale();
  const token = String(formData.get("token") ?? "");
  if (!(await allowPersistentRequest("customer-verification-confirm", token || "empty", 8, 15 * 60_000))) {
    return { ok: false, message: pick(locale, "Demasiados intentos. Solicitá un enlace nuevo.", "Too many attempts. Request a new link.", "Muitas tentativas. Solicite um novo link.") };
  }

  const accountId = await consumeEmailVerification(token);
  if (accountId === null) {
    return { ok: false, message: pick(locale, "El enlace no es válido, ya fue usado o venció.", "The link is invalid, already used, or expired.", "O link não é válido, já foi usado ou expirou.") };
  }
  if (!(await createCustomerSession(accountId))) {
    return { ok: false, message: pick(locale, "El email fue confirmado, pero no pudimos iniciar la sesión.", "Your email was confirmed, but we could not sign you in.", "O e-mail foi confirmado, mas não foi possível iniciar a sessão.") };
  }
  redirect("/cuenta?verificacion=confirmada");
}
