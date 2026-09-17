import "server-only";

import webpush from "web-push";

/**
 * Web Push estándar con VAPID.
 *
 * La clave privada solo existe en el servidor. El navegador recibe únicamente la
 * clave pública para suscribirse. No hay servicio pago de por medio: el mensaje va
 * cifrado directo al servicio push del navegador (Google, Mozilla, Apple…).
 */

export interface PushConfiguration {
  readonly ready: boolean;
  readonly publicKey: string | null;
  readonly message: string;
}

interface VapidDetails {
  readonly subject: string;
  readonly publicKey: string;
  readonly privateKey: string;
}

function decodedLength(value: string): number {
  return /^[A-Za-z0-9_-]+$/.test(value) ? Buffer.from(value, "base64url").length : -1;
}

function readVapidDetails(): VapidDetails | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() ?? "";
  // Clave pública P-256 sin comprimir (65 bytes) y privada de 32 bytes.
  if (decodedLength(publicKey) !== 65 || decodedLength(privateKey) !== 32) return null;
  if (!/^(mailto:[^\s@]+@[^\s@]+|https:\/\/\S+)$/.test(subject)) return null;
  return { subject, publicKey, privateKey };
}

export function getPushConfiguration(): PushConfiguration {
  const details = readVapidDetails();
  if (details === null) {
    return {
      ready: false,
      publicKey: null,
      message: "Faltan o no son válidas VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY y VAPID_SUBJECT.",
    };
  }
  return {
    ready: true,
    publicKey: details.publicKey,
    message: "Notificaciones push configuradas.",
  };
}

export interface PushSubscriptionKeys {
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

export type PushSendResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly gone: boolean; readonly statusCode: number | null };

export interface PushSender {
  readonly ready: boolean;
  send(subscription: PushSubscriptionKeys, payload: string): Promise<PushSendResult>;
}

export function createWebPushSender(details: VapidDetails | null = readVapidDetails()): PushSender {
  return {
    ready: details !== null,

    async send(subscription, payload) {
      if (details === null) return { ok: false, gone: false, statusCode: null };
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { ...subscription.keys } },
          payload,
          {
            vapidDetails: details,
            TTL: 24 * 60 * 60,
            urgency: "high",
            timeout: 10_000,
          },
        );
        return { ok: true };
      } catch (error) {
        const statusCode =
          typeof (error as { statusCode?: unknown }).statusCode === "number"
            ? (error as { statusCode: number }).statusCode
            : null;
        // 404/410: la suscripción ya no existe y conviene borrarla.
        return { ok: false, gone: statusCode === 404 || statusCode === 410, statusCode };
      }
    },
  };
}

export function generateVapidKeys(): { readonly publicKey: string; readonly privateKey: string } {
  return webpush.generateVAPIDKeys();
}
