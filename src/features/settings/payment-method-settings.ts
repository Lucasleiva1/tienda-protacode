import "server-only";

import { getKeyValueStore, STORES, type KeyValueStore } from "@/lib/storage/store";
import {
  MANUAL_PAYMENT_METHOD_IDS,
  type ManualPaymentMethodId,
  type PaymentMethodSettings,
} from "@/types/manual-payment";

/**
 * Medios de pago manuales administrados desde el panel.
 *
 * Los datos (alias, CVU, QR, instrucciones) se guardan en el almacén de
 * configuración, no en el código. Son datos PÚBLICOS: se muestran a cualquier
 * comprador que elige el medio, así que acá no va nada secreto.
 */

const KEY = "payment-methods";

interface StoredPaymentMethods {
  readonly methods: readonly PaymentMethodSettings[];
  readonly updatedAt: string;
}

export const DEFAULT_PAYMENT_METHODS: readonly PaymentMethodSettings[] = [
  {
    id: "prex",
    kind: "transfer",
    name: "Prex",
    active: false,
    alias: null,
    cvu: null,
    holder: null,
    instructions: null,
    qr: null,
    updatedAt: null,
  },
  {
    id: "uala",
    kind: "transfer",
    name: "Ualá",
    active: false,
    alias: null,
    cvu: null,
    holder: null,
    instructions: null,
    qr: null,
    updatedAt: null,
  },
  {
    id: "transfer",
    kind: "transfer",
    name: "Transferencia / QR",
    active: false,
    alias: null,
    cvu: null,
    holder: null,
    instructions: null,
    qr: null,
    updatedAt: null,
  },
  {
    id: "whatsapp",
    kind: "whatsapp",
    name: "WhatsApp",
    active: true,
    alias: null,
    cvu: null,
    holder: null,
    instructions: "Escribinos por WhatsApp y coordinamos el pago.",
    qr: null,
    updatedAt: null,
  },
];

export function isManualPaymentMethodId(value: unknown): value is ManualPaymentMethodId {
  return typeof value === "string" && (MANUAL_PAYMENT_METHOD_IDS as readonly string[]).includes(value);
}

/** Un medio se ofrece solo si está activo y tiene con qué pagar. */
export function isPaymentMethodUsable(method: PaymentMethodSettings): boolean {
  if (!method.active) return false;
  if (method.kind === "whatsapp") return true;
  return method.alias !== null || method.cvu !== null || method.qr !== null;
}

const QR_PREFIX = "/api/media/payment-methods/";

function sanitizeStored(
  base: PaymentMethodSettings,
  stored: Partial<PaymentMethodSettings> | undefined,
): PaymentMethodSettings {
  if (stored === undefined) return base;
  const text = (value: unknown, max: number): string | null =>
    typeof value === "string" && value.trim() !== "" ? value.trim().slice(0, max) : null;
  const qr =
    stored.qr !== null &&
    typeof stored.qr === "object" &&
    typeof stored.qr.src === "string" &&
    stored.qr.src.startsWith(QR_PREFIX)
      ? { src: stored.qr.src, alt: text(stored.qr.alt, 160) ?? `QR de ${base.name}` }
      : null;
  return {
    ...base,
    name: text(stored.name, 40) ?? base.name,
    active: stored.active === true,
    alias: base.kind === "transfer" ? text(stored.alias, 30) : null,
    cvu: base.kind === "transfer" ? text(stored.cvu, 22) : null,
    holder: base.kind === "transfer" ? text(stored.holder, 80) : null,
    instructions: text(stored.instructions, 600),
    qr: base.kind === "transfer" ? qr : null,
    updatedAt: typeof stored.updatedAt === "string" ? stored.updatedAt : null,
  };
}

export async function getPaymentMethodSettings(
  store: KeyValueStore = getKeyValueStore(STORES.settings),
): Promise<readonly PaymentMethodSettings[]> {
  const saved = await store.get<StoredPaymentMethods>(KEY);
  const byId = new Map((saved?.methods ?? []).map((method) => [method.id, method]));
  return DEFAULT_PAYMENT_METHODS.map((base) => sanitizeStored(base, byId.get(base.id)));
}

export interface PublicPaymentMethod {
  readonly id: ManualPaymentMethodId;
  readonly kind: PaymentMethodSettings["kind"];
  readonly name: string;
  readonly alias: string | null;
  readonly cvu: string | null;
  readonly holder: string | null;
  readonly instructions: string | null;
  readonly qrSrc: string | null;
  readonly qrAlt: string | null;
}

export function toPublicPaymentMethod(method: PaymentMethodSettings): PublicPaymentMethod {
  return {
    id: method.id,
    kind: method.kind,
    name: method.name,
    alias: method.alias,
    cvu: method.cvu,
    holder: method.holder,
    instructions: method.instructions,
    qrSrc: method.qr?.src ?? null,
    qrAlt: method.qr?.alt ?? null,
  };
}

export async function getActivePaymentMethods(): Promise<readonly PublicPaymentMethod[]> {
  const methods = await getPaymentMethodSettings();
  return methods.filter(isPaymentMethodUsable).map(toPublicPaymentMethod);
}

/* ------------------------------ edición ------------------------------ */

export interface PaymentMethodInput {
  readonly name: string;
  readonly active: boolean;
  readonly alias: string;
  readonly cvu: string;
  readonly holder: string;
  readonly instructions: string;
  readonly qr: { readonly src: string; readonly alt: string } | null;
}

export type PaymentMethodField = "name" | "active" | "alias" | "cvu" | "holder" | "instructions" | "qr";

export type PaymentMethodErrors = Partial<Record<PaymentMethodField, string>>;

export type ValidatePaymentMethodResult =
  | { readonly ok: true; readonly value: PaymentMethodSettings }
  | { readonly ok: false; readonly errors: PaymentMethodErrors };

function clean(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function validatePaymentMethodInput(
  id: ManualPaymentMethodId,
  input: PaymentMethodInput,
  now: string,
): ValidatePaymentMethodResult {
  const base = DEFAULT_PAYMENT_METHODS.find((method) => method.id === id);
  if (base === undefined) return { ok: false, errors: { name: "Medio de pago desconocido." } };

  const errors: PaymentMethodErrors = {};
  const name = clean(input.name);
  if (name.length < 2 || name.length > 40) errors.name = "Escribí un nombre de 2 a 40 caracteres.";

  const instructions = input.instructions.trim().replace(/\r\n/g, "\n");
  if (instructions.length > 600) errors.instructions = "Máximo 600 caracteres.";

  let alias: string | null = null;
  let cvu: string | null = null;
  let holder: string | null = null;
  let qr: PaymentMethodSettings["qr"] = null;

  if (base.kind === "transfer") {
    const rawAlias = input.alias.trim();
    if (rawAlias !== "") {
      if (!/^[A-Za-z0-9.-]{6,30}$/.test(rawAlias)) {
        errors.alias = "El alias lleva de 6 a 30 letras, números, puntos o guiones, sin espacios.";
      } else {
        alias = rawAlias;
      }
    }

    const rawCvu = input.cvu.replace(/[\s-]/g, "");
    if (rawCvu !== "") {
      if (!/^\d{22}$/.test(rawCvu)) errors.cvu = "El CVU/CBU tiene 22 números.";
      else cvu = rawCvu;
    }

    const rawHolder = clean(input.holder);
    if (rawHolder.length > 80) errors.holder = "Máximo 80 caracteres.";
    else if (rawHolder !== "") holder = rawHolder;

    if (input.qr !== null) {
      if (!input.qr.src.startsWith(QR_PREFIX) || input.qr.src.includes("..")) {
        errors.qr = "El QR tiene que subirse desde este panel.";
      } else {
        qr = { src: input.qr.src, alt: clean(input.qr.alt).slice(0, 160) || `QR de ${name}` };
      }
    }

    if (input.active && alias === null && cvu === null && qr === null && errors.alias === undefined && errors.cvu === undefined) {
      errors.active = "Para activarlo cargá al menos un alias, un CVU o un QR.";
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      id,
      kind: base.kind,
      name,
      active: input.active,
      alias,
      cvu,
      holder,
      instructions: instructions === "" ? null : instructions,
      qr,
      updatedAt: now,
    },
  };
}

export async function savePaymentMethod(
  id: ManualPaymentMethodId,
  input: PaymentMethodInput,
  store: KeyValueStore = getKeyValueStore(STORES.settings),
): Promise<ValidatePaymentMethodResult> {
  const now = new Date().toISOString();
  const validated = validatePaymentMethodInput(id, input, now);
  if (!validated.ok) return validated;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await store.getWithVersion<StoredPaymentMethods>(KEY);
    const methods = (current?.value.methods ?? []).filter((method) => method.id !== id);
    const next: StoredPaymentMethods = { methods: [...methods, validated.value], updatedAt: now };
    const saved =
      current === null
        ? await store.setIfAbsent(KEY, next)
        : await store.setIfVersion(KEY, next, current.version);
    if (saved) return validated;
  }
  throw new Error("PAYMENT_METHODS_CONCURRENT_UPDATE");
}
