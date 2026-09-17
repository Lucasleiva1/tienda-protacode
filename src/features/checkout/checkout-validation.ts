import { pick, type Locale } from "@/i18n/shared";
import { normalizeWhatsAppNumber } from "@/lib/utils/whatsapp-number";
import type { OrderCustomer } from "@/types/order";

/**
 * Validación del checkout.
 *
 * El mismo archivo lo usan el formulario y el servidor. Que el navegador valide es
 * una comodidad para el comprador; la validación que MANDA es la del servidor, porque
 * cualquiera puede saltearse la del navegador.
 *
 * Sin librería: son pocos campos y las reglas entran en una pantalla. Sumar una
 * dependencia de validación para esto no se justifica.
 */

export interface CheckoutFormValues {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly confirmEmail: string;
  /** Opcional. Con código de país. */
  readonly whatsapp: string;
  readonly acceptedTerms: boolean;
}

export type CheckoutField = keyof CheckoutFormValues;

export type CheckoutErrors = Partial<Record<CheckoutField, string>>;

const MIN_NOMBRE = 2;
const MAX_NOMBRE = 60;
const MAX_EMAIL = 254;

/** Suficiente para descartar lo evidente sin rechazar direcciones válidas raras. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Saca espacios de los extremos y aplasta los repetidos del medio. */
function normalizarNombre(valor: string): string {
  return valor.trim().replace(/\s+/g, " ");
}

/** Los emails se comparan y se guardan en minúsculas y sin espacios. */
export function normalizarEmail(valor: string): string {
  return valor.trim().toLowerCase();
}

export interface CheckoutValidationOk {
  readonly ok: true;
  readonly customer: OrderCustomer;
}

export interface CheckoutValidationError {
  readonly ok: false;
  readonly errors: CheckoutErrors;
}

export function validateCheckout(
  values: CheckoutFormValues,
  locale: Locale = "es",
): CheckoutValidationOk | CheckoutValidationError {
  const errors: Record<string, string> = {};

  const firstName = normalizarNombre(String(values.firstName ?? ""));
  const lastName = normalizarNombre(String(values.lastName ?? ""));
  const email = normalizarEmail(String(values.email ?? ""));
  const confirmEmail = normalizarEmail(String(values.confirmEmail ?? ""));
  const whatsappText = String(values.whatsapp ?? "").trim();
  const whatsapp = whatsappText === "" ? null : normalizeWhatsAppNumber(whatsappText);

  if (firstName.length < MIN_NOMBRE) {
    errors.firstName = pick(locale, "Escribí tu nombre.", "Enter your first name.", "Digite seu nome.");
  } else if (firstName.length > MAX_NOMBRE) {
    errors.firstName = pick(locale, `El nombre no puede superar los ${MAX_NOMBRE} caracteres.`, `First name cannot exceed ${MAX_NOMBRE} characters.`, `O nome não pode ter mais de ${MAX_NOMBRE} caracteres.`);
  }

  if (lastName.length < MIN_NOMBRE) {
    errors.lastName = pick(locale, "Escribí tu apellido.", "Enter your last name.", "Digite seu sobrenome.");
  } else if (lastName.length > MAX_NOMBRE) {
    errors.lastName = pick(locale, `El apellido no puede superar los ${MAX_NOMBRE} caracteres.`, `Last name cannot exceed ${MAX_NOMBRE} characters.`, `O sobrenome não pode ter mais de ${MAX_NOMBRE} caracteres.`);
  }

  if (email === "") {
    errors.email = pick(locale, "Escribí tu email.", "Enter your email.", "Digite seu e-mail.");
  } else if (email.length > MAX_EMAIL || !EMAIL.test(email)) {
    errors.email = pick(locale, "Ese email no parece válido.", "That email does not look valid.", "Esse e-mail não parece válido.");
  }

  if (confirmEmail === "") {
    errors.confirmEmail = pick(locale, "Repetí tu email.", "Repeat your email.", "Repita seu e-mail.");
  } else if (errors.email === undefined && confirmEmail !== email) {
    errors.confirmEmail = pick(locale, "Los dos emails no coinciden.", "The two emails do not match.", "Os dois e-mails não coincidem.");
  }

  if (whatsappText !== "" && whatsapp === null) {
    errors.whatsapp = pick(locale, "Escribí el número con código de país, por ejemplo 54 9 11 1234-5678.", "Enter the number with the country code, for example 54 9 11 1234-5678.", "Digite o número com o código do país, por exemplo 54 9 11 1234-5678.");
  }

  if (values.acceptedTerms !== true) {
    errors.acceptedTerms = pick(locale, "Tenés que aceptar las condiciones para continuar.", "You must accept the terms to continue.", "Você precisa aceitar as condições para continuar.");
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, customer: { firstName, lastName, email, whatsapp } };
}
