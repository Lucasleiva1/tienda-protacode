import "server-only";

import { getKeyValueStore, STORES } from "@/lib/storage/store";

const KEY = "sales-channel";

/** Número inicial confirmado por el propietario. WhatsApp requiere código de país. */
export const DEFAULT_WHATSAPP_NUMBER = "5491150540281";

interface SalesSettingsRecord {
  readonly whatsappNumber: string;
  readonly updatedAt: string;
}

function validStoredNumber(value: unknown): value is string {
  return typeof value === "string" && /^\d{8,15}$/.test(value);
}

/**
 * Prioridad: valor cambiado desde el Admin, variable de entorno y valor inicial.
 * Así el primer deploy funciona y luego el dueño puede administrarlo sin redeploy.
 */
export async function getConfiguredWhatsAppNumber(): Promise<string> {
  const store = getKeyValueStore(STORES.settings);
  const saved = await store.get<SalesSettingsRecord>(KEY);
  if (validStoredNumber(saved?.whatsappNumber)) return saved.whatsappNumber;

  const environment = process.env.WHATSAPP_NUMBER?.replace(/\D/g, "");
  if (validStoredNumber(environment)) return environment;

  return DEFAULT_WHATSAPP_NUMBER;
}

export async function saveConfiguredWhatsAppNumber(number: string): Promise<void> {
  if (!validStoredNumber(number)) throw new Error("WHATSAPP_NUMBER_INVALID");

  await getKeyValueStore(STORES.settings).set<SalesSettingsRecord>(KEY, {
    whatsappNumber: number,
    updatedAt: new Date().toISOString(),
  });
}
