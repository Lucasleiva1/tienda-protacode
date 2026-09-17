import "server-only";

import { createHash } from "node:crypto";
import { getKeyValueStore, STORES } from "@/lib/storage/store";
import type { CustomerAccount } from "@/types/customer-account";

const accountKey = (id: string) => `account:${id}`;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const emailKey = (email: string) => `email:${digest(email)}`;
const googleKey = (subject: string) => `google:${digest(subject)}`;

export interface CreateCustomerInput {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly passwordHash: string | null;
  readonly googleSubject: string | null;
  readonly emailVerified: boolean;
  readonly avatarUrl?: string | null;
}

const store = () => getKeyValueStore(STORES.customers);

/** Completa cuentas guardadas antes de los campos nuevos, sin reescribirlas. */
function normalizeAccount(account: CustomerAccount | null): CustomerAccount | null {
  if (account === null) return null;
  const legacy = account as CustomerAccount & Partial<CustomerAccount>;
  return {
    ...account,
    avatarUrl: legacy.avatarUrl ?? null,
    sessionVersion: Number.isSafeInteger(legacy.sessionVersion) ? legacy.sessionVersion : 0,
  };
}

/** Solo fotos HTTPS de Google: nunca una URL arbitraria que venga de otro lado. */
export function safeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1024) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(".googleusercontent.com")
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export async function findCustomerById(id: string): Promise<CustomerAccount | null> {
  return normalizeAccount(await store().get<CustomerAccount>(accountKey(id)));
}

export async function findCustomerByEmail(email: string): Promise<CustomerAccount | null> {
  const id = await store().get<string>(emailKey(email));
  return id === null ? null : findCustomerById(id);
}

export async function findCustomerByGoogleSubject(
  subject: string,
): Promise<CustomerAccount | null> {
  const id = await store().get<string>(googleKey(subject));
  return id === null ? null : findCustomerById(id);
}

async function releaseIndex(key: string, id: string): Promise<void> {
  const current = await store().get<string>(key);
  if (current === id) await store().remove(key);
}

/** Actualización con escritura condicional. `null` si la cuenta no existe. */
async function updateCustomer(
  id: string,
  updater: (current: CustomerAccount) => CustomerAccount | null,
): Promise<CustomerAccount | null> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await store().getWithVersion<CustomerAccount>(accountKey(id));
    if (current === null) return null;
    const normalized = normalizeAccount(current.value) as CustomerAccount;
    const next = updater(normalized);
    if (next === null || next === normalized) return normalized;
    const updated = { ...next, updatedAt: new Date().toISOString() };
    if (await store().setIfVersion(accountKey(id), updated, current.version)) return updated;
  }
  return null;
}

/** Devuelve null cuando el correo o la identidad de Google ya están ocupados. */
export async function createCustomer(
  input: CreateCustomerInput,
): Promise<CustomerAccount | null> {
  const id = crypto.randomUUID();
  const emailIndex = emailKey(input.email);
  if (!(await store().setIfAbsent(emailIndex, id))) return null;

  const googleIndex = input.googleSubject === null ? null : googleKey(input.googleSubject);
  if (googleIndex !== null && !(await store().setIfAbsent(googleIndex, id))) {
    await releaseIndex(emailIndex, id);
    return null;
  }

  const now = new Date().toISOString();
  const account: CustomerAccount = {
    id,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    passwordHash: input.passwordHash,
    googleSubject: input.googleSubject,
    emailVerified: input.emailVerified,
    avatarUrl: safeAvatarUrl(input.avatarUrl),
    sessionVersion: 0,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await store().set(accountKey(id), account);
    return account;
  } catch (error) {
    await releaseIndex(emailIndex, id);
    if (googleIndex !== null) await releaseIndex(googleIndex, id);
    throw error;
  }
}

/**
 * Vincula Google sin permitir que un subject quede asociado a dos cuentas.
 *
 * Si la cuenta existente nunca confirmó su email, su contraseña se descarta y sus
 * sesiones se invalidan: quien la creó no demostró ser dueño del correo, y Google
 * sí lo demostró. Sin esto, alguien podría registrar de antemano el email de otra
 * persona y conservar acceso después de que la persona real entre con Google.
 */
export async function linkGoogleIdentity(
  account: CustomerAccount,
  subject: string,
  avatarUrl: string | null = null,
): Promise<CustomerAccount | null> {
  if (account.googleSubject === subject) return account;
  if (account.googleSubject !== null) return null;

  const index = googleKey(subject);
  if (!(await store().setIfAbsent(index, account.id))) {
    const existing = await store().get<string>(index);
    return existing === account.id ? findCustomerById(account.id) : null;
  }

  const linked = await updateCustomer(account.id, (current) => {
    if (current.googleSubject !== null) return null;
    const provenOwner = current.emailVerified;
    return {
      ...current,
      googleSubject: subject,
      emailVerified: true,
      passwordHash: provenOwner ? current.passwordHash : null,
      sessionVersion: provenOwner ? current.sessionVersion : current.sessionVersion + 1,
      avatarUrl: current.avatarUrl ?? safeAvatarUrl(avatarUrl),
    };
  });

  if (linked === null || linked.googleSubject !== subject) {
    await releaseIndex(index, account.id);
    return null;
  }
  return linked;
}

/** Guarda la foto de Google si todavía no había una o si cambió. */
export async function refreshCustomerAvatar(
  id: string,
  avatarUrl: string | null,
): Promise<CustomerAccount | null> {
  const safe = safeAvatarUrl(avatarUrl);
  return updateCustomer(id, (current) =>
    safe === null || current.avatarUrl === safe ? current : { ...current, avatarUrl: safe },
  );
}

/** Invalida todas las sesiones emitidas hasta ahora para la cuenta. */
export async function incrementCustomerSessionVersion(id: string): Promise<void> {
  await updateCustomer(id, (current) => ({
    ...current,
    sessionVersion: current.sessionVersion + 1,
  }));
}

export async function markCustomerEmailVerified(
  id: string,
  expectedEmail: string,
): Promise<CustomerAccount | null> {
  const updated = await updateCustomer(id, (current) => {
    if (current.email !== expectedEmail) return null;
    if (current.emailVerified) return current;
    return { ...current, emailVerified: true };
  });
  return updated !== null && updated.email === expectedEmail && updated.emailVerified
    ? updated
    : null;
}
