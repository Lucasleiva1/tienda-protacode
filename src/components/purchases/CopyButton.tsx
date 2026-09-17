"use client";

import { useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/utils/copy-text";

interface CopyButtonProps {
  readonly value: string;
  readonly label: string;
  readonly copiedLabel: string;
  readonly failedLabel: string;
  readonly className?: string;
}

const MS_CONFIRMACION = 2400;

/** Botón de copiar que funciona también por http en la red local (ver `copyText`). */
export function CopyButton({ value, label, copiedLabel, failedLabel, className = "" }: CopyButtonProps) {
  const [estado, setEstado] = useState<"idle" | "copied" | "failed">("idle");
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current !== null) clearTimeout(temporizador.current);
    },
    [],
  );

  async function copiar() {
    const ok = await copyText(value);
    setEstado(ok ? "copied" : "failed");
    if (temporizador.current !== null) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEstado("idle"), MS_CONFIRMACION);
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={() => void copiar()}
        className="min-h-10 border border-accent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {estado === "copied" ? copiedLabel : label}
      </button>
      <span aria-live="polite" className="text-xs text-muted">
        {estado === "failed" ? failedLabel : ""}
      </span>
    </span>
  );
}
