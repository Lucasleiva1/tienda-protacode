"use client";

import { useEffect, useState, useTransition } from "react";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/features/admin/push-actions";

interface PushNotificationsPanelProps {
  /** Clave pública VAPID. `null` si el servidor no tiene las claves. */
  readonly publicKey: string | null;
  readonly devices: number;
}

type Support = "checking" | "unsupported" | "ios-install" | "supported";

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function sameKey(a: ArrayBuffer | null | undefined, b: Uint8Array): boolean {
  if (a === null || a === undefined || a.byteLength !== b.byteLength) return false;
  const view = new Uint8Array(a);
  return view.every((value, index) => value === b[index]);
}

function deviceLabel(): string {
  const agent = navigator.userAgent;
  const system = /iPhone|iPad/.test(agent)
    ? "iPhone/iPad"
    : /Android/.test(agent)
      ? "Android"
      : /Windows/.test(agent)
        ? "Windows"
        : /Mac OS X/.test(agent)
          ? "Mac"
          : "Dispositivo";
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /Firefox\//.test(agent)
      ? "Firefox"
      : /Chrome\//.test(agent)
        ? "Chrome"
        : /Safari\//.test(agent)
          ? "Safari"
          : "Navegador";
  return `${system} · ${browser}`;
}

function detectSupport(): Support {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const capable = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (ios && !standalone) return "ios-install";
  return capable ? "supported" : "unsupported";
}

export function PushNotificationsPanel({ publicKey, devices }: PushNotificationsPanelProps) {
  const [support, setSupport] = useState<Support>("checking");
  const [subscribed, setSubscribed] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    const detected = detectSupport();
    (async () => {
      // Todo el trabajo es asíncrono: el estado se actualiza después de leer el navegador.
      await Promise.resolve();
      let active = false;
      if (detected === "supported" && publicKey !== null) {
        const registration = await navigator.serviceWorker.getRegistration("/admin");
        const current = await registration?.pushManager.getSubscription();
        active =
          current !== null &&
          current !== undefined &&
          sameKey(current.options.applicationServerKey, base64UrlToBytes(publicKey));
      }
      if (!cancelled) {
        setSupport(detected);
        setSubscribed(active);
      }
    })().catch(() => {
      if (!cancelled) setSupport(detected);
    });
    return () => {
      cancelled = true;
    };
  }, [publicKey]);

  function activate() {
    if (publicKey === null) return;
    setMessage("");
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setMessage(
            permission === "denied"
              ? "Las notificaciones están bloqueadas para este sitio. Habilitalas en los permisos del navegador y volvé a intentar."
              : "No se concedió el permiso de notificaciones.",
          );
          return;
        }
        const registration = await navigator.serviceWorker.register("/admin-sw.js", {
          scope: "/admin",
          updateViaCache: "none",
        });
        await navigator.serviceWorker.ready;
        const key = base64UrlToBytes(publicKey);
        const previous = await registration.pushManager.getSubscription();
        if (previous !== null && !sameKey(previous.options.applicationServerKey, key)) {
          await previous.unsubscribe();
        }
        const subscription =
          (await registration.pushManager.getSubscription()) ??
          (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
        const result = await savePushSubscriptionAction(subscription.toJSON(), deviceLabel());
        setMessage(result.message);
        setSubscribed(result.ok);
      } catch {
        setMessage("No se pudo activar en este navegador. Probá desde Chrome, Edge, Firefox o el panel instalado en el iPhone.");
      }
    });
  }

  function deactivate() {
    setMessage("");
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration("/admin");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription !== null && subscription !== undefined) {
          await removePushSubscriptionAction(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setSubscribed(false);
        setMessage("Notificaciones desactivadas en este dispositivo.");
      } catch {
        setMessage("No se pudo desactivar. Probá de nuevo.");
      }
    });
  }

  function test() {
    setMessage("");
    startTransition(async () => {
      const result = await sendTestPushAction();
      setMessage(result.message);
    });
  }

  return (
    <section aria-labelledby="notificaciones" className="border border-border bg-surface p-5">
      <h2 id="notificaciones" className="eyebrow text-accent-contrast">
        Notificaciones en este dispositivo
      </h2>

      {publicKey === null ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Faltan las claves VAPID en el servidor. Generalas con <code>npm run push:claves</code> y cargalas como
          variables de entorno.
        </p>
      ) : support === "checking" ? (
        <p className="mt-3 text-sm text-muted">Revisando el navegador…</p>
      ) : support === "ios-install" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          En iPhone o iPad primero instalá el panel: tocá Compartir → «Agregar a pantalla de inicio», abrilo desde
          ese ícono y volvé a esta sección para activar las notificaciones (iOS 16.4 o superior).
        </p>
      ) : support === "unsupported" ? (
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Este navegador no admite notificaciones push. Usá Chrome, Edge o Firefox, o el panel instalado.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            {subscribed
              ? "Activas: vas a recibir un aviso cada vez que un cliente toque «Ya pagué»."
              : "Activalas para recibir un aviso cuando un cliente informe un pago."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {subscribed ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={test}
                  className="min-h-11 bg-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent-foreground disabled:opacity-50"
                >
                  Enviar prueba
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={deactivate}
                  className="min-h-11 border border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground disabled:opacity-50"
                >
                  Desactivar
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={activate}
                className="min-h-11 bg-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent-foreground disabled:opacity-50"
              >
                Activar notificaciones
              </button>
            )}
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-muted">Dispositivos activos: {devices}</p>
      <p aria-live="polite" className="mt-2 text-sm text-foreground">
        {message}
      </p>
    </section>
  );
}
