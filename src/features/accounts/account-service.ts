import "server-only";

import { hashPassword, verifyPassword } from "@/features/admin/password";
import {
  createCustomer,
  findCustomerByEmail,
  findCustomerByGoogleSubject,
  linkGoogleIdentity,
  refreshCustomerAvatar,
} from "@/features/accounts/customer-repository";
import type { CustomerAccount, CustomerProfile } from "@/types/customer-account";

export function normalizeCustomerEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function customerProfile(account: CustomerAccount): CustomerProfile {
  return {
    id: account.id,
    email: account.email,
    firstName: account.firstName,
    lastName: account.lastName,
    emailVerified: account.emailVerified,
    hasPassword: account.passwordHash !== null,
    hasGoogle: account.googleSubject !== null,
    avatarUrl: account.avatarUrl,
  };
}

export async function registerCustomer(input: {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly password: string;
}): Promise<CustomerAccount | null> {
  return createCustomer({
    email: normalizeCustomerEmail(input.email),
    firstName: input.firstName,
    lastName: input.lastName,
    passwordHash: await hashPassword(input.password),
    googleSubject: null,
    emailVerified: false,
  });
}

export async function authenticateCustomer(
  email: string,
  password: string,
): Promise<CustomerAccount | null> {
  const account = await findCustomerByEmail(normalizeCustomerEmail(email));
  if (account === null || account.passwordHash === null) {
    // Mantiene un costo comparable aunque el correo no exista.
    await hashPassword(password);
    return null;
  }
  return (await verifyPassword(password, account.passwordHash)) ? account : null;
}

/**
 * Busca por `sub` de Google y solo si no existe crea o vincula. Así, entrar dos
 * veces con la misma cuenta de Google nunca crea un segundo usuario.
 */
export async function findOrCreateGoogleCustomer(input: {
  readonly subject: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly emailVerified: boolean;
  readonly avatarUrl?: string | null;
}): Promise<CustomerAccount | null> {
  if (!input.emailVerified) return null;
  const avatarUrl = input.avatarUrl ?? null;

  const bySubject = await findCustomerByGoogleSubject(input.subject);
  if (bySubject !== null) {
    return (await refreshCustomerAvatar(bySubject.id, avatarUrl)) ?? bySubject;
  }

  const email = normalizeCustomerEmail(input.email);
  const byEmail = await findCustomerByEmail(email);
  if (byEmail !== null) return linkGoogleIdentity(byEmail, input.subject, avatarUrl);

  const created = await createCustomer({
    email,
    firstName: input.firstName,
    lastName: input.lastName,
    passwordHash: null,
    googleSubject: input.subject,
    emailVerified: true,
    avatarUrl,
  });
  if (created !== null) return created;

  // Dos ingresos simultáneos con la misma cuenta: gana uno y el otro lo reutiliza.
  return findCustomerByGoogleSubject(input.subject);
}
