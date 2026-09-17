import "server-only";

import { escapeHtml, getEmailConfiguration, sendEmail } from "@/lib/email/mailer";
import type { CustomerAccount } from "@/types/customer-account";

export { getEmailConfiguration } from "@/lib/email/mailer";

export async function sendVerificationEmail(
  account: CustomerAccount,
  token: string,
): Promise<boolean> {
  const config = getEmailConfiguration();
  if (!config.ready || config.origin === null) return false;

  const verificationUrl = new URL("/cuenta/confirmar", config.origin);
  verificationUrl.searchParams.set("token", token);
  const href = escapeHtml(verificationUrl.toString());

  const result = await sendEmail({
    to: account.email,
    subject: "Confirmá tu cuenta de Prota Code",
    text: [
      "Confirmá tu cuenta de Prota Code.",
      "",
      `Abrí este enlace y presioná Confirmar cuenta: ${verificationUrl.toString()}`,
      "",
      "El enlace vence en 24 horas y puede usarse una sola vez.",
      "Si no creaste esta cuenta, ignorá este mensaje.",
    ].join("\n"),
    html: `<p>Confirmá tu cuenta de Prota Code.</p><p><a href="${href}">Confirmar mi cuenta</a></p><p>El enlace vence en 24 horas y puede usarse una sola vez.</p><p>Si no creaste esta cuenta, ignorá este mensaje.</p>`,
  });
  return result === "sent";
}
