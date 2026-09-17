import "server-only";

import {
  deliveryReadyEmail,
  orderAccessEmail,
  orderCreatedEmail,
  paymentApprovedEmail,
  type OrderEmailLinks,
} from "@/features/notifications/order-emails";
import {
  getPushSubscriptionRepository,
  type PushSubscriptionRepository,
} from "@/features/notifications/push-subscription-repository";
import {
  adminOrderPath,
  orderDisplayReference,
  orderProductSummary,
} from "@/features/orders/order-display";
import type { OrderRepository } from "@/features/orders/order-repository";
import { getOrderRepository } from "@/features/orders/persistent-order-repository";
import { issueAdditionalPurchaseAccess } from "@/features/purchases/purchase-access";
import {
  getEmailConfiguration,
  sendEmail,
  type EmailMessage,
  type EmailSendResult,
} from "@/lib/email/mailer";
import { paymentLog } from "@/lib/payments/payment-logger";
import { createWebPushSender, type PushSender } from "@/lib/push/web-push-sender";
import { formatMoney } from "@/lib/utils/money";
import type { Order, OrderNotifications } from "@/types/order";

/**
 * NotificationService: avisos al Admin (push) y al comprador (email).
 *
 * Nada de lo que falle acá revierte un pago ni una entrega: los avisos son
 * accesorios. Los emails automáticos se envían como máximo una vez por pedido.
 */

export interface PushSummary {
  readonly configured: boolean;
  readonly devices: number;
  readonly sent: number;
  readonly failed: number;
  readonly removed: number;
}

export type EmailOutcome = "sent" | "skipped" | "not_configured" | "failed";

export interface PushPayload {
  readonly title: string;
  readonly body: string;
  readonly url: string;
  readonly tag: string;
}

export interface NotificationServiceDependencies {
  readonly orders: OrderRepository;
  readonly subscriptions: PushSubscriptionRepository;
  readonly push: PushSender;
  readonly sendEmail: (message: EmailMessage) => Promise<EmailSendResult>;
  /** Origen público para armar enlaces. `null` cuando el email no está configurado. */
  readonly emailOrigin: () => string | null;
  /** Nuevo enlace privado adicional (token plano) o `null` si el pedido no existe. */
  readonly issueAccessLink: (orderId: string) => Promise<string | null>;
  readonly clock?: () => Date;
}

/** Aviso al Admin: producto, pedido, importe y medio. Sin datos del comprador. */
export function paymentReportedPush(order: Order): PushPayload {
  const reference = orderDisplayReference(order);
  const lines = [
    orderProductSummary(order),
    `Pedido ${reference}`,
    formatMoney(order.total),
    order.manualPayment?.methodLabel ?? "Medio sin informar",
  ];
  return {
    title: "Nueva compra pendiente",
    body: lines.join("\n"),
    url: adminOrderPath(order),
    tag: `pedido-${reference}`,
  };
}

type EmailFlag = keyof OrderNotifications;

export class NotificationService {
  constructor(private readonly dependencies: NotificationServiceDependencies) {}

  async paymentReported(order: Order): Promise<PushSummary> {
    return this.pushToAll(paymentReportedPush(order));
  }

  async sendAdminTest(): Promise<PushSummary> {
    return this.pushToAll({
      title: "Notificaciones activas",
      body: "Este dispositivo va a recibir los pagos para verificar.",
      url: "/admin",
      tag: "prueba",
    });
  }

  async orderCreated(order: Order, purchaseToken: string): Promise<EmailOutcome> {
    const origin = this.dependencies.emailOrigin();
    if (origin === null) return "not_configured";
    return this.send(orderCreatedEmail(order, this.links(order, origin, purchaseToken)), order, "ORDER_CREATED");
  }

  async paymentApproved(order: Order): Promise<EmailOutcome> {
    const origin = this.dependencies.emailOrigin();
    if (origin === null) return "not_configured";
    const claimed = await this.claim(order.id, "paymentApprovedEmailAt");
    if (claimed === null) return "skipped";
    const token = await this.dependencies.issueAccessLink(claimed.id);
    return this.send(paymentApprovedEmail(claimed, this.links(claimed, origin, token)), claimed, "PAYMENT_APPROVED");
  }

  async deliveryReady(order: Order): Promise<EmailOutcome> {
    const origin = this.dependencies.emailOrigin();
    if (origin === null) return "not_configured";
    const claimed = await this.claim(order.id, "deliveryReadyEmailAt");
    if (claimed === null) return "skipped";
    return this.sendDelivery(claimed, origin);
  }

  /** Reenvío explícito desde el Admin: no depende de la marca de "ya enviado". */
  async resendDelivery(order: Order): Promise<EmailOutcome> {
    const origin = this.dependencies.emailOrigin();
    if (origin === null) return "not_configured";
    if (order.status !== "fulfilled") return "skipped";
    return this.sendDelivery(order, origin);
  }

  /** Recuperación de acceso para compras como invitado. */
  async sendAccessLink(order: Order): Promise<EmailOutcome> {
    const origin = this.dependencies.emailOrigin();
    if (origin === null) return "not_configured";
    const token = await this.dependencies.issueAccessLink(order.id);
    if (token === null) return "failed";
    return this.send(orderAccessEmail(order, this.links(order, origin, token)), order, "ACCESS_LINK");
  }

  private async sendDelivery(order: Order, origin: string): Promise<EmailOutcome> {
    const token = await this.dependencies.issueAccessLink(order.id);
    return this.send(deliveryReadyEmail(order, this.links(order, origin, token)), order, "DELIVERY_READY");
  }

  private links(order: Order, origin: string, token: string | null): OrderEmailLinks {
    return {
      purchaseUrl: token === null ? null : `${origin}/compras/${encodeURIComponent(token)}`,
      accountUrl: order.customer.accountId ? `${origin}/cuenta/compras` : null,
    };
  }

  private async send(message: EmailMessage, order: Order, kind: string): Promise<EmailOutcome> {
    const result = await this.dependencies.sendEmail(message);
    paymentLog(result === "sent" ? "info" : "warn", `EMAIL_${kind}_${result.toUpperCase()}`, {
      orderId: order.id,
    });
    return result;
  }

  /** Marca el email como enviado ANTES de enviarlo: nunca sale dos veces. */
  private async claim(orderId: string, flag: EmailFlag): Promise<Order | null> {
    const now = (this.dependencies.clock?.() ?? new Date()).toISOString();
    let claimed = false;
    const updated = await this.dependencies.orders.updateAtomically(orderId, (current) => {
      claimed = false;
      if (current.notifications[flag] !== null) return current;
      claimed = true;
      return { ...current, notifications: { ...current.notifications, [flag]: now } };
    });
    return claimed ? updated : null;
  }

  private async pushToAll(payload: PushPayload): Promise<PushSummary> {
    const { push, subscriptions } = this.dependencies;
    if (!push.ready) return { configured: false, devices: 0, sent: 0, failed: 0, removed: 0 };

    const devices = await subscriptions.list();
    const body = JSON.stringify(payload);
    const results = await Promise.all(
      devices.map(async (device) => {
        const result = await push.send(device, body);
        if (result.ok) {
          await subscriptions.recordResult(device.id, true);
          return "sent" as const;
        }
        if (result.gone) {
          await subscriptions.remove(device.endpoint);
          return "removed" as const;
        }
        await subscriptions.recordResult(device.id, false);
        return "failed" as const;
      }),
    );

    const summary: PushSummary = {
      configured: true,
      devices: devices.length,
      sent: results.filter((value) => value === "sent").length,
      failed: results.filter((value) => value === "failed").length,
      removed: results.filter((value) => value === "removed").length,
    };
    paymentLog("info", "ADMIN_PUSH_SENT", {
      tag: payload.tag,
      devices: summary.devices,
      sent: summary.sent,
      failed: summary.failed,
      removed: summary.removed,
    });
    return summary;
  }
}

export function createNotificationService(): NotificationService {
  return new NotificationService({
    orders: getOrderRepository(),
    subscriptions: getPushSubscriptionRepository(),
    push: createWebPushSender(),
    sendEmail,
    emailOrigin: () => {
      const config = getEmailConfiguration();
      return config.ready ? config.origin : null;
    },
    issueAccessLink: (orderId) => issueAdditionalPurchaseAccess(orderId),
  });
}
