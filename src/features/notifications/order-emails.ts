import "server-only";

import { orderDisplayReference } from "@/features/orders/order-display";
import { escapeHtml, type EmailMessage } from "@/lib/email/mailer";
import { formatMoney } from "@/lib/utils/money";
import type { Order } from "@/types/order";

/**
 * Textos de los emails del pedido.
 *
 * Todo dato variable se escapa antes de entrar al HTML. La licencia viaja en el
 * cuerpo porque el comprador la pidió por email; nunca se escribe en los logs.
 * El programa NO se adjunta: los correos bloquean .exe, .msi, .apk y .dmg (aun
 * dentro de un .zip), así que la descarga va por el enlace privado.
 */

export interface OrderEmailLinks {
  /** Enlace privado del pedido (`/compras/<token>`). */
  readonly purchaseUrl: string | null;
  /** "Mis compras" para quien tiene cuenta. */
  readonly accountUrl: string | null;
}

interface Block {
  readonly text: string;
  readonly html: string;
}

function paragraph(value: string): Block {
  return { text: value, html: `<p style="margin:0 0 14px">${escapeHtml(value)}</p>` };
}

function link(label: string, url: string): Block {
  const href = escapeHtml(url);
  return {
    text: `${label}: ${url}`,
    html: `<p style="margin:0 0 18px"><a href="${href}" style="display:inline-block;background:#d47a42;color:#111827;padding:12px 20px;text-decoration:none;font-weight:600">${escapeHtml(label)}</a></p><p style="margin:0 0 14px;font-size:12px;color:#555555;word-break:break-all">${href}</p>`,
  };
}

function compose(to: string, subject: string, blocks: readonly Block[]): EmailMessage {
  const footer = paragraph(
    "No compartas este email: los enlaces y las licencias son personales. Si no hiciste esta compra, ignorá el mensaje.",
  );
  const all = [...blocks, footer];
  return {
    to,
    subject,
    text: all.map((block) => block.text).join("\n\n"),
    html: `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#111111"><div style="max-width:560px;margin:0 auto;background:#ffffff;padding:28px;border:1px solid #e1e4e8"><p style="margin:0 0 20px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#b35c28">Prota Code</p>${all
      .map((block) => block.html)
      .join("")}</div></body></html>`,
  };
}

function greeting(order: Order): Block {
  return paragraph(`Hola, ${order.customer.firstName}.`);
}

function accessBlocks(links: OrderEmailLinks, label: string): readonly Block[] {
  const blocks: Block[] = [];
  if (links.purchaseUrl !== null) blocks.push(link(label, links.purchaseUrl));
  if (links.accountUrl !== null) {
    blocks.push(paragraph(`También podés verla en Mis compras: ${links.accountUrl}`));
  }
  return blocks;
}

function itemBlocks(order: Order): readonly Block[] {
  return order.items.map((item) => {
    const lines = [`${item.name} (versión ${item.version})`];
    if (item.licenseStatus === "issued" && item.licenseKey !== null) {
      lines.push(`Licencia: ${item.licenseKey}`);
    } else if (item.licenseStatus === "not_required") {
      lines.push("Este programa no requiere licencia.");
    }
    lines.push(
      item.downloadFile !== null
        ? `Descarga: ${item.downloadFile.fileName} (desde tu enlace privado)`
        : "Descarga: en preparación",
    );
    return {
      text: lines.join("\n"),
      html: `<div style="margin:0 0 16px;padding:14px;border:1px solid #e1e4e8;background:#fafbfc">${lines
        .map((line, index) =>
          index === 0
            ? `<p style="margin:0 0 8px;font-weight:700">${escapeHtml(line)}</p>`
            : line.startsWith("Licencia: ")
              ? `<p style="margin:0 0 6px">Licencia: <code style="font-size:15px;background:#eef2ff;padding:3px 6px">${escapeHtml(line.slice("Licencia: ".length))}</code></p>`
              : `<p style="margin:0 0 6px">${escapeHtml(line)}</p>`,
        )
        .join("")}</div>`,
    };
  });
}

export function orderCreatedEmail(order: Order, links: OrderEmailLinks): EmailMessage {
  const reference = orderDisplayReference(order);
  return compose(order.customer.email, `Recibimos tu pedido ${reference}`, [
    greeting(order),
    paragraph(`Registramos tu pedido ${reference} por ${formatMoney(order.total)}.`),
    paragraph(
      "Para pagar, abrí tu enlace privado, elegí Prex, Ualá, transferencia/QR o WhatsApp y, cuando hayas pagado, tocá \"Ya pagué\". Vamos a verificar el ingreso y te avisamos.",
    ),
    ...accessBlocks(links, "Ver mi pedido y pagar"),
  ]);
}

export function paymentApprovedEmail(order: Order, links: OrderEmailLinks): EmailMessage {
  const reference = orderDisplayReference(order);
  return compose(order.customer.email, `Pago aprobado: pedido ${reference}`, [
    greeting(order),
    paragraph(`Confirmamos el pago de tu pedido ${reference}.`),
    paragraph(
      "Estamos terminando de preparar tu licencia y la descarga. Te enviamos otro email apenas esté lista; no necesitás volver a pagar.",
    ),
    ...accessBlocks(links, "Ver mi pedido"),
  ]);
}

export function deliveryReadyEmail(order: Order, links: OrderEmailLinks): EmailMessage {
  const reference = orderDisplayReference(order);
  return compose(order.customer.email, `Tu compra ${reference} está lista: licencia y descarga`, [
    greeting(order),
    paragraph(
      order.total.amount > 0
        ? `Tu pago del pedido ${reference} está confirmado y tu compra está lista.`
        : `Tu pedido ${reference} está listo.`,
    ),
    ...itemBlocks(order),
    ...accessBlocks(links, "Descargar y ver mi licencia"),
  ]);
}

export function orderAccessEmail(order: Order, links: OrderEmailLinks): EmailMessage {
  const reference = orderDisplayReference(order);
  return compose(order.customer.email, `Tu enlace privado del pedido ${reference}`, [
    greeting(order),
    paragraph(`Pediste recuperar el acceso a tu pedido ${reference}. Este es tu enlace privado:`),
    ...accessBlocks(links, "Abrir mi pedido"),
  ]);
}
