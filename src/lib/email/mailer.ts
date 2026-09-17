import "server-only";

import nodemailer from "nodemailer";

/**
 * Envío de emails transaccionales por SMTP.
 *
 * Es el mismo SMTP que ya confirmaba cuentas. Si falta configuración:
 *   - en producción, no se envía nada y se informa "no configurado";
 *   - con `npm run dev`, el mensaje se guarda en `.data/outbox/` para poder abrirlo y
 *     probar los enlaces en la PC. Esa carpeta está ignorada por Git.
 */

export interface EmailConfiguration {
  readonly ready: boolean;
  readonly host: string | null;
  readonly port: number;
  readonly user: string | null;
  readonly password: string | null;
  readonly from: string | null;
  readonly origin: string | null;
  /** `true` cuando los mensajes van a la bandeja local de desarrollo. */
  readonly localOutbox: boolean;
}

export function getEmailConfiguration(): EmailConfiguration {
  const host = process.env.SMTP_HOST?.trim() || null;
  const user = process.env.SMTP_USER?.trim() || null;
  const password = process.env.SMTP_PASSWORD?.trim() || null;
  const from = process.env.EMAIL_FROM?.trim() || null;
  const rawPort = Number(process.env.SMTP_PORT ?? "587");
  const port = Number.isInteger(rawPort) && rawPort > 0 && rawPort <= 65535 ? rawPort : 587;
  const development = process.env.NODE_ENV === "development";
  const rawOrigin = process.env.PUBLIC_SITE_URL?.trim() || process.env.URL?.trim() ||
    (development ? "http://localhost:3000" : null);

  let origin: string | null = null;
  if (rawOrigin !== null) {
    try {
      const parsed = new URL(rawOrigin);
      if (parsed.protocol === "https:" || development) {
        origin = parsed.origin;
      }
    } catch {
      origin = null;
    }
  }

  const smtpReady =
    host !== null && user !== null && password !== null && from !== null && origin !== null;

  return {
    ready: smtpReady || (development && origin !== null),
    host,
    port,
    user,
    password,
    from,
    origin,
    localOutbox: !smtpReady && development && origin !== null,
  };
}

export interface EmailMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

export type EmailSendResult = "sent" | "not_configured" | "failed";

const LOCAL_FROM = "Prota Code (desarrollo) <no-reply@localhost>";

async function saveToLocalOutbox(message: EmailMessage): Promise<void> {
  const transporter = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "windows",
  });
  const info = await transporter.sendMail({ from: LOCAL_FROM, ...message });
  const path = await import("node:path");
  const fs = await import("node:fs/promises");
  const directory = path.join(process.cwd(), ".data", "outbox");
  await fs.mkdir(/*turbopackIgnore: true*/ directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const name = `${stamp}-${crypto.randomUUID().slice(0, 8)}.eml`;
  await fs.writeFile(/*turbopackIgnore: true*/ path.join(directory, name), info.message as Buffer);
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const config = getEmailConfiguration();
  if (!config.ready) return "not_configured";

  try {
    if (config.localOutbox) {
      await saveToLocalOutbox(message);
      return "sent";
    }
    if (config.host === null || config.user === null || config.password === null || config.from === null) {
      return "not_configured";
    }
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      requireTLS: config.port !== 465,
      auth: { user: config.user, pass: config.password },
    });
    await transporter.sendMail({ from: config.from, ...message });
    return "sent";
  } catch {
    // El detalle del error puede traer datos del servidor SMTP: no se propaga.
    return "failed";
  }
}

/** Escapa texto para insertarlo dentro de HTML de un email. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
