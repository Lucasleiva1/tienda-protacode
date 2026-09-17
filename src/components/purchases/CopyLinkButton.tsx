"use client";

import { useSyncExternalStore } from "react";
import { CopyButton } from "@/components/purchases/CopyButton";
import { pick, type Locale } from "@/i18n/shared";

function subscribe(): () => void {
  return () => undefined;
}

/** Copia la dirección privada que el comprador tiene abierta. */
export function CopyLinkButton({ locale }: { readonly locale: Locale }) {
  // La dirección solo existe en el navegador; en el servidor el botón no se dibuja.
  const href = useSyncExternalStore(
    subscribe,
    () => window.location.href,
    () => "",
  );
  if (href === "") return null;

  return (
    <CopyButton
      className="mt-4"
      value={href}
      label={pick(locale, "Copiar enlace", "Copy link", "Copiar link")}
      copiedLabel={pick(locale, "Enlace copiado", "Link copied", "Link copiado")}
      failedLabel={pick(locale, "Copiá la dirección desde la barra del navegador.", "Copy the address from the browser bar.", "Copie o endereço da barra do navegador.")}
    />
  );
}
