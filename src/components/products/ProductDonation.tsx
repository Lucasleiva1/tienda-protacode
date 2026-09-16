"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { pick, type Locale } from "@/i18n/shared";
import { copyText } from "@/lib/utils/copy-text";
import type { ProductImage } from "@/types/product";

interface ProductDonationProps {
  readonly alias: string | null;
  readonly qr: ProductImage | null;
  /** Clase de la tipografía elegida para el alias. Vacía = la del sitio. */
  readonly aliasFontClass?: string;
  /**
   * "columna": tarjeta alta para la barra lateral de escritorio.
   * "barra": franja baja y ancha, para la cinta fija de celular.
   */
  readonly variante?: "columna" | "barra";
  /**
   * Id del título.
   *
   * La ficha dibuja las dos variantes y solo una se ve por vez; con ids distintos no
   * se repite un id en la página, que rompería la lectura con lector de pantalla.
   */
  readonly headingId?: string;
  readonly locale: Locale;
}

const MS_CONFIRMACION = 2600;

/**
 * Aporte voluntario.
 *
 * No es una compra: no toca el carrito, no crea pedido y no habilita nada. Si no hay
 * alias ni QR no se dibuja nada, para no dejar una sección vacía.
 *
 * El alias y el QR NUNCA se ponen uno al lado del otro: en un ancho de 320 px el
 * alias terminaba partido letra por letra. Siempre van uno debajo del otro.
 */
export function ProductDonation({
  alias,
  qr,
  aliasFontClass = "",
  variante = "columna",
  headingId = "aportes",
  locale,
}: ProductDonationProps) {
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState(false);
  const [qrAbierto, setQrAbierto] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current !== null) clearTimeout(temporizador.current);
    },
    [],
  );

  if (alias === null && qr === null) return null;

  async function copiar(valor: string) {
    const copio = await copyText(valor);
    setCopiado(copio);
    setError(!copio);
    if (temporizador.current !== null) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      setCopiado(false);
      setError(false);
    }, MS_CONFIRMACION);
  }

  const aviso = copiado
    ? pick(locale, "Alias copiado", "Alias copied", "Chave copiada")
    : error
      ? pick(
          locale,
          "No pudimos copiarlo. Tocalo y copialo a mano.",
          "We could not copy it. Tap it and copy it manually.",
          "Não foi possível copiar. Toque nele e copie manualmente.",
        )
      : "";

  const titulo = pick(locale, "Apoyá el proyecto", "Support the project", "Apoie o projeto");
  const etiquetaCopiar = pick(locale, "Copiar alias", "Copy alias", "Copiar chave");
  const nota = pick(
    locale,
    "El aporte es voluntario y no es necesario para usar la aplicación.",
    "The contribution is voluntary and is not required to use the application.",
    "A contribuição é voluntária e não é necessária para usar o aplicativo.",
  );

  /* --------------------------- barra de celular --------------------------- */

  if (variante === "barra") {
    return (
      <section
        aria-labelledby={headingId}
        className="border border-border bg-surface/95 backdrop-blur"
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          {qr !== null ? (
            <button
              type="button"
              onClick={() => setQrAbierto((abierto) => !abierto)}
              aria-expanded={qrAbierto}
              className="shrink-0 border border-border bg-background p-1 transition-colors hover:border-accent"
            >
              <Image
                src={qr.src}
                alt={pick(locale, "Ver QR para aportar", "View contribution QR", "Ver QR para apoiar")}
                width={48}
                height={48}
                unoptimized
                className="h-11 w-11"
              />
            </button>
          ) : null}

          <div className="min-w-0 flex-1">
            <h2 id={headingId} className="eyebrow text-accent-contrast">
              {titulo}
            </h2>
            {alias !== null ? (
              <p className={`truncate text-sm text-foreground ${aliasFontClass}`}>
                <span className="select-all">{alias}</span>
              </p>
            ) : (
              <p className="truncate text-xs text-muted">
                {pick(locale, "Escaneá el QR", "Scan the QR", "Escaneie o QR")}
              </p>
            )}
          </div>

          {alias !== null ? (
            <button
              type="button"
              onClick={() => void copiar(alias)}
              className="shrink-0 border border-accent px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {copiado
                ? pick(locale, "Copiado", "Copied", "Copiada")
                : pick(locale, "Copiar", "Copy", "Copiar")}
            </button>
          ) : null}
        </div>

        {qrAbierto && qr !== null ? (
          <div className="border-t border-border px-3 py-4 text-center">
            <Image
              src={qr.src}
              alt={qr.alt}
              width={200}
              height={200}
              unoptimized
              className="mx-auto h-auto w-full max-w-[190px] border border-border bg-background p-2"
            />
          </div>
        ) : null}

        <p aria-live="polite" className="sr-only">
          {aviso}
        </p>
      </section>
    );
  }

  /* -------------------------- columna de escritorio -------------------------- */

  return (
    <section aria-labelledby={headingId} className="border border-border bg-surface">
      <div aria-hidden="true" className="ml-5 h-px w-12 bg-accent" />

      <div className="p-5">
        <p className="eyebrow text-accent-contrast">
          {pick(locale, "Aporte voluntario", "Voluntary contribution", "Apoio voluntário")}
        </p>

        <h2 id={headingId} className="display mt-2 text-2xl">
          {titulo}
        </h2>

        <p className="mt-2 text-xs leading-relaxed text-muted">
          {pick(
            locale,
            "Si te resultó útil y querés apoyar su desarrollo, podés hacer un aporte.",
            "If it was useful and you want to support its development, you can contribute.",
            "Se foi útil e você quer apoiar o desenvolvimento, pode contribuir.",
          )}
        </p>

        {alias !== null ? (
          <div className="mt-4">
            <p className="eyebrow">{pick(locale, "Alias", "Alias", "Chave")}</p>
            <p className="mt-1.5 border border-border bg-background px-3 py-2.5 text-center text-base leading-tight text-foreground">
              <span className={`select-all break-words ${aliasFontClass}`}>{alias}</span>
            </p>
            <button
              type="button"
              onClick={() => void copiar(alias)}
              className="mt-2 w-full border border-accent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {etiquetaCopiar}
            </button>
            <p aria-live="polite" className="mt-1.5 min-h-4 text-[0.7rem] leading-tight text-muted">
              {aviso}
            </p>
          </div>
        ) : null}

        {qr !== null ? (
          <div className={alias === null ? "mt-4" : "mt-3"}>
            <p className="eyebrow">{pick(locale, "QR", "QR", "QR")}</p>
            <Image
              src={qr.src}
              alt={qr.alt}
              width={240}
              height={240}
              unoptimized
              className="mx-auto mt-1.5 h-auto w-full max-w-[190px] border border-border bg-background p-2"
            />
          </div>
        ) : null}

        <div aria-hidden="true" className="mt-4 h-px w-12 bg-border" />
        <p className="mt-3 text-[0.7rem] leading-relaxed text-muted">{nota}</p>
      </div>
    </section>
  );
}
