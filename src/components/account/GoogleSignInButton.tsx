"use client";

import { useEffect, useRef, useState } from "react";
import {
  signInWithGoogleAction,
  startGoogleSignInAction,
} from "@/features/accounts/google-actions";
import { pick, type Locale } from "@/i18n/shared";

/**
 * Botón oficial "Continuar con Google" (Google Identity Services).
 *
 * Abre la ventana emergente de Google y recibe una credencial (ID token). Esa
 * credencial viaja al servidor, que es el único que decide si el ingreso es
 * válido. Solo se pide identidad básica: nada de Gmail, Drive ni contactos.
 */

interface GoogleCredentialResponse {
  readonly credential?: string;
}

interface GoogleIdentityApi {
  accounts: {
    id: {
      initialize(config: Record<string, unknown>): void;
      renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentityApi;
  }
}

const SCRIPT_ID = "google-identity-services";
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function loadGoogleScript(): Promise<void> {
  if (window.google?.accounts?.id !== undefined) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const done = () => (window.google?.accounts?.id !== undefined ? resolve() : reject(new Error("GIS_MISSING")));
    script.addEventListener("load", done, { once: true });
    script.addEventListener("error", () => reject(new Error("GIS_LOAD_FAILED")), { once: true });
    if (existing === null) {
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  });
}

function googleLocale(locale: Locale): string {
  return pick(locale, "es-419", "en", "pt-BR");
}

export interface GoogleSignInButtonProps {
  /** Ruta interna a la que se vuelve después de entrar. */
  readonly next: string;
  readonly locale: Locale;
  /** Ingreso por redirección, por si el navegador bloquea la ventana emergente. */
  readonly fallbackHref: string | null;
}

type Status = "loading" | "ready" | "working" | "unavailable";

export function GoogleSignInButton({ next, locale, fallbackHref }: GoogleSignInButtonProps) {
  const container = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);
  const t = (es: string, en: string, pt: string) => pick(locale, es, en, pt);

  useEffect(() => {
    let cancelled = false;

    async function handleCredential(response: GoogleCredentialResponse) {
      if (cancelled) return;
      setStatus("working");
      setMessage("");
      try {
        const result = await signInWithGoogleAction({ credential: response.credential, next });
        if (result.ok) {
          // Recarga completa: el encabezado y la página toman la sesión nueva.
          window.location.assign(result.redirectTo);
          return;
        }
        setMessage(result.message);
      } catch {
        setMessage(
          pick(
            locale,
            "No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.",
            "We could not reach the server. Check your connection and try again.",
            "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
          ),
        );
      }
      // Cada intento usa un nonce nuevo.
      setAttempt((value) => value + 1);
    }

    async function prepare() {
      const start = await startGoogleSignInAction();
      if (cancelled) return;
      if (!start.ok) {
        setStatus("unavailable");
        setMessage(start.message);
        return;
      }
      await loadGoogleScript();
      if (cancelled || container.current === null || window.google === undefined) return;

      window.google.accounts.id.initialize({
        client_id: start.clientId,
        callback: handleCredential,
        nonce: start.nonce,
        ux_mode: "popup",
        context: "signin",
        auto_select: false,
        itp_support: true,
      });
      container.current.replaceChildren();
      const width = Math.max(200, Math.min(400, Math.floor(container.current.clientWidth || 320)));
      window.google.accounts.id.renderButton(container.current, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: String(width),
        locale: googleLocale(locale),
      });
      setStatus("ready");
    }

    prepare().catch(() => {
      if (cancelled) return;
      setStatus("unavailable");
      setMessage(
        pick(
          locale,
          "No pudimos cargar el ingreso con Google. Revisá tu conexión o un bloqueador de contenido.",
          "We could not load Google sign-in. Check your connection or content blocker.",
          "Não foi possível carregar o login com Google. Verifique sua conexão ou bloqueador de conteúdo.",
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [attempt, locale, next]);

  return (
    <div className="w-full">
      <div
        aria-busy={status === "loading" || status === "working"}
        className={`flex min-h-11 w-full items-center justify-center ${status === "working" ? "pointer-events-none opacity-60" : ""}`}
      >
        {status === "loading" ? (
          <span className="text-xs text-muted">{t("Cargando Google…", "Loading Google…", "Carregando Google…")}</span>
        ) : null}
        {/* Google dibuja el botón acá adentro: React no le pone hijos a este div. */}
        {/* color-scheme light: sin esto el iframe de Google pinta un fondo blanco en páginas oscuras. */}
        <div ref={container} className="flex w-full justify-center [color-scheme:light] empty:hidden" />
      </div>

      {status === "working" ? (
        <p aria-live="polite" className="mt-2 text-center text-xs text-muted">
          {t("Verificando tu cuenta de Google…", "Verifying your Google account…", "Verificando sua conta Google…")}
        </p>
      ) : null}

      {message !== "" ? (
        <p aria-live="polite" className="mt-3 border border-danger/50 bg-danger/10 px-3 py-2 text-sm">
          {message}
        </p>
      ) : null}

      <p className="mt-2 text-center text-xs leading-relaxed text-muted">
        {t(
          "Solo usamos tu nombre, email y foto. No accedemos a Gmail, Drive ni contactos.",
          "We only use your name, email and photo. We do not access Gmail, Drive or contacts.",
          "Usamos apenas seu nome, e-mail e foto. Não acessamos Gmail, Drive nem contatos.",
        )}
        {fallbackHref !== null && status !== "unavailable" ? (
          <>
            {" "}
            <a href={fallbackHref} className="underline decoration-border underline-offset-4 hover:text-foreground">
              {t("¿No se abrió la ventana?", "Window did not open?", "A janela não abriu?")}
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}
