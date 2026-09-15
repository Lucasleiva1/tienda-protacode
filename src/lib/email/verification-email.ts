import "server-only";

import nodemailer from "nodemailer";
import type { CustomerAccount } from "@/types/customer-account";

interface EmailConfiguration {
  readonly ready: boolean;
  readonly host: string | null;
  readonly port: number;
  readonly user: string | null;
  readonly password: string | null;
  readonly from: string | null;
  readonly origin: string | null;
}

export function getEmailConfiguration(): EmailConfiguration {
  const host = process.env.SMTP_HOST?.trim() || null;
  const user = process.env.SMTP_USER?.trim() || null;
  const password = process.env.SMTP_PASSWORD?.trim() || null;
  const from = process.env.EMAIL_FROM?.trim() || null;
  const rawPort = Number(process.env.SMTP_PORT ?? "587");
  const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 587;
  const rawOrigin = process.env.PUBLIC_SITE_URL?.trim() || process.env.URL?.trim() ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : null);

  let origin: string | null = null;
  if (rawOrigin !== null) {
    try {
      const parsed = new URL(rawOrigin);
      if (parsed.protocol === "https:" || process.env.NODE_ENV === "development") {
        origin = parsed.origin;
      }
    } catch {
      origin = null;
    }
  }

  return {
    ready: host !== null && user !== null && password !== null && from !== null && origin !== null,
    host,
    port,
    user,
    password,
    from,
    origin,
  };
}

export async function sendVerificationEmail(
  account: CustomerAccount,
  token: string,
): Promise<boolean> {
  const config = getEmailConfiguration();
  if (
    !config.ready ||
    config.host === null ||
    config.user === null ||
    config.password === null ||
    config.from === null ||
    config.origin === null
  ) return false;

  const verificationUrl = new URL("/cuenta/confirmar", config.origin);
  verificationUrl.searchParams.set("token", token);

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      requireTLS: config.port !== 465,
      auth: { user: config.user, pass: config.password },
    });
    await transporter.sendMail({
      from: config.from,
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
      html: `<p>Confirmá tu cuenta de Prota Code.</p><p><a href="${verificationUrl.toString()}">Confirmar mi cuenta</a></p><p>El enlace vence en 24 horas y puede usarse una sola vez.</p><p>Si no creaste esta cuenta, ignorá este mensaje.</p>`,
    });
    return true;
  } catch {
    return false;
  }
}
