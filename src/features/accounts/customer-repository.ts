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
}

const store = () => getKeyValueStore(STORES.customers);

export async function findCustomerById(id: string): Promise<CustomerAccount | null> {
  return store().get<CustomerAccount>(accountKey(id));
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
    ...input,
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

/** Vincula Google sin permitir que un subject quede asociado a dos cuentas. */
export async function linkGoogleIdentity(
  account: CustomerAccount,
  subject: string,
): Promise<CustomerAccount | null> {
  if (account.googleSubject === subject) return account;
  if (account.googleSubject !== null) return null;

  const index = googleKey(subject);
  if (!(await store().setIfAbsent(index, account.id))) {
    const existing = await store().get<string>(index);
    return existing === account.id ? findCustomerById(account.id) : null;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await store().getWithVersion<CustomerAccount>(accountKey(account.id));
    if (current === null || current.value.googleSubject !== null) break;
    const updated: CustomerAccount = {
      ...current.value,
      googleSubject: subject,
      emailVerified: true,
      updatedAt: new Date().toISOString(),
    };
    if (await store().setIfVersion(accountKey(account.id), updated, current.version)) {
      return updated;
    }
  }

  await releaseIndex(index, account.id);
  return null;
}

export async function markCustomerEmailVerified(
  id: string,
  expectedEmail: string,
): Promise<CustomerAccount | null> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await store().getWithVersion<CustomerAccount>(accountKey(id));
    if (current === null || current.value.email !== expectedEmail) return null;
    if (current.value.emailVerified) return current.value;

    const updated: CustomerAccount = {
      ...current.value,
      emailVerified: true,
      updatedAt: new Date().toISOString(),
    };
    if (await store().setIfVersion(accountKey(id), updated, current.version)) return updated;
  }
  return null;
}
