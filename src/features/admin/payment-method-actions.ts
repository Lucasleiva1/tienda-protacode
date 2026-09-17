"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, NO_AUTORIZADO } from "@/features/admin/guard";
import { savePaymentMethodQr } from "@/features/admin/media";
import {
  isManualPaymentMethodId,
  savePaymentMethod,
  type PaymentMethodErrors,
  type PaymentMethodInput,
} from "@/features/settings/payment-method-settings";

export type PaymentMethodActionResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly message: string; readonly errors?: PaymentMethodErrors };

function readInput(value: unknown): PaymentMethodInput {
  const source = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const text = (key: string, max: number) =>
    typeof source[key] === "string" ? (source[key] as string).slice(0, max) : "";
  const qr = source.qr as { src?: unknown; alt?: unknown } | null | undefined;
  return {
    name: text("name", 100),
    active: source.active === true,
    alias: text("alias", 100),
    cvu: text("cvu", 60),
    holder: text("holder", 200),
    instructions: text("instructions", 1200),
    qr:
      qr !== null && typeof qr === "object" && typeof qr.src === "string"
        ? { src: qr.src.slice(0, 300), alt: typeof qr.alt === "string" ? qr.alt.slice(0, 200) : "" }
        : null,
  };
}

export async function savePaymentMethodAction(
  methodId: unknown,
  input: unknown,
): Promise<PaymentMethodActionResult> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  if (!isManualPaymentMethodId(methodId)) return { ok: false, message: "Medio de pago desconocido." };

  const result = await savePaymentMethod(methodId, readInput(input));
  if (!result.ok) return { ok: false, message: "Revisá los campos marcados.", errors: result.errors };

  revalidatePath("/admin/medios-de-pago");
  revalidatePath("/", "layout");
  return {
    ok: true,
    message: result.value.active ? "Guardado. El medio está activo." : "Guardado. El medio está inactivo.",
  };
}

export async function uploadPaymentQrAction(
  methodId: unknown,
  formData: FormData,
): Promise<{ readonly ok: true; readonly url: string } | { readonly ok: false; readonly message: string }> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };
  if (!isManualPaymentMethodId(methodId) || methodId === "whatsapp") {
    return { ok: false, message: "Este medio no usa QR." };
  }
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) return { ok: false, message: "No llegó ningún archivo." };
  const result = await savePaymentMethodQr(methodId, archivo);
  return result.ok ? { ok: true, url: result.url } : result;
}
