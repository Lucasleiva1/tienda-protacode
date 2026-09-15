"use server";

import { revalidatePath } from "next/cache";
import { isAdmin, NO_AUTORIZADO } from "@/features/admin/guard";
import { normalizeWhatsAppNumber } from "@/features/checkout/whatsapp";
import { saveConfiguredWhatsAppNumber } from "@/features/settings/sales-settings";

export interface WhatsAppSettingsActionState {
  readonly ok: boolean | null;
  readonly message: string;
}

export async function saveWhatsAppNumberAction(
  _previous: WhatsAppSettingsActionState,
  formData: FormData,
): Promise<WhatsAppSettingsActionState> {
  if (!(await isAdmin())) return { ok: false, message: NO_AUTORIZADO };

  const number = normalizeWhatsAppNumber(String(formData.get("whatsappNumber") ?? ""));
  if (number === null) {
    return {
      ok: false,
      message: "Ingresá el código de país y el número. Por ejemplo: 5491150540281.",
    };
  }

  await saveConfiguredWhatsAppNumber(number);
  revalidatePath("/", "layout");
  revalidatePath("/admin/configuracion");

  return { ok: true, message: "Número de WhatsApp actualizado." };
}
