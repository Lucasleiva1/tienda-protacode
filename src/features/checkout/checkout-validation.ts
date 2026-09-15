import type { OrderCustomer } from "@/types/order";

/**
 * Validación del checkout.
 *
 * El mismo archivo lo usan el formulario y el servidor. Que el navegador valide es
 * una comodidad para el comprador; la validación que MANDA es la del servidor, porque
 * cualquiera puede saltearse la del navegador.
 *
 * Sin librería: son cuatro campos y las reglas entran en una pantalla. Sumar una
 * dependencia de validación para esto no se justifica.
 */

export interface CheckoutFormValues {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly confirmEmail: string;
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
): CheckoutValidationOk | CheckoutValidationError {
  const errors: Record<string, string> = {};

  const firstName = normalizarNombre(values.firstName);
  const lastName = normalizarNombre(values.lastName);
  const email = normalizarEmail(values.email);
  const confirmEmail = normalizarEmail(values.confirmEmail);

  if (firstName.length < MIN_NOMBRE) {
    errors.firstName = "Escribí tu nombre.";
  } else if (firstName.length > MAX_NOMBRE) {
    errors.firstName = `El nombre no puede superar los ${MAX_NOMBRE} caracteres.`;
  }

  if (lastName.length < MIN_NOMBRE) {
    errors.lastName = "Escribí tu apellido.";
  } else if (lastName.length > MAX_NOMBRE) {
    errors.lastName = `El apellido no puede superar los ${MAX_NOMBRE} caracteres.`;
  }

  if (email === "") {
    errors.email = "Escribí tu email.";
  } else if (email.length > MAX_EMAIL || !EMAIL.test(email)) {
    errors.email = "Ese email no parece válido.";
  }

  if (confirmEmail === "") {
    errors.confirmEmail = "Repetí tu email.";
  } else if (errors.email === undefined && confirmEmail !== email) {
    errors.confirmEmail = "Los dos emails no coinciden.";
  }

  if (!values.acceptedTerms) {
    errors.acceptedTerms = "Tenés que aceptar las condiciones para continuar.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, customer: { firstName, lastName, email } };
}
