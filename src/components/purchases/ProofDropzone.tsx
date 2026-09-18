"use client";

import { useEffect, useRef, useState } from "react";
import { pick, type Locale } from "@/i18n/shared";

/**
 * Zona para adjuntar el comprobante de pago.
 *
 * Tiene que ser fácil para el comprador, porque es obligatorio:
 *   - se arrastra el archivo, se toca para buscarlo (en el celular abre galería o
 *     cámara) o se pega una captura con Ctrl+V;
 *   - las fotos pesadas se achican en el navegador antes de subirse, así una foto
 *     de celular de 6 MB no termina en un error de "archivo muy grande".
 *
 * El archivo final vive en un `<input type="file" name={name}>` real, así que el
 * formulario lo envía con `FormData` como cualquier otro campo.
 */

export const PROOF_MAX_BYTES = 3 * 1024 * 1024;
const PROOF_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf,.jpg,.jpeg,.png,.webp,.pdf";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_TYPES = [...IMAGE_TYPES, "application/pdf"];

/** Por encima de esto una imagen se re-codifica como JPEG más liviano. */
const COMPRESS_FROM_BYTES = 1.5 * 1024 * 1024;
const MAX_SIDE = 2000;

type Preparado =
  | { readonly ok: true; readonly file: File }
  | { readonly ok: false; readonly reason: "type" | "size" };

async function achicarImagen(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * escala);
  canvas.height = Math.round(bitmap.height * escala);
  const ctx = canvas.getContext("2d");
  if (ctx === null) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (blob === null || blob.size >= file.size) return file;
  const base = file.name.replace(/\.[^.]+$/, "") || "comprobante";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

async function preparar(file: File): Promise<Preparado> {
  if (!ALLOWED_TYPES.includes(file.type)) return { ok: false, reason: "type" };
  let final = file;
  if (IMAGE_TYPES.includes(file.type) && file.size > COMPRESS_FROM_BYTES) {
    try {
      final = await achicarImagen(file);
    } catch {
      final = file;
    }
  }
  if (final.size > PROOF_MAX_BYTES) return { ok: false, reason: "size" };
  return { ok: true, file: final };
}

function tamano(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export interface ProofDropzoneProps {
  readonly name: string;
  readonly locale: Locale;
  readonly disabled?: boolean;
  /** Muestra el borde en rojo cuando el formulario se intentó enviar sin archivo. */
  readonly missing?: boolean;
  readonly onChange?: (file: File | null) => void;
}

export function ProofDropzone({ name, locale, disabled = false, missing = false, onChange }: ProofDropzoneProps) {
  const t = (es: string, en: string, pt: string) => pick(locale, es, en, pt);
  const input = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  // La vista previa es un blob: local; se libera al cambiar de archivo y al desmontar.
  const previewUrl = useRef<string | null>(null);
  function cambiarVista(nuevo: File | null) {
    if (previewUrl.current !== null) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = nuevo !== null && nuevo.type.startsWith("image/") ? URL.createObjectURL(nuevo) : null;
    setPreview(previewUrl.current);
  }
  useEffect(
    () => () => {
      if (previewUrl.current !== null) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  async function elegir(original: File | undefined) {
    if (original === undefined || disabled) return;
    setError("");
    setWorking(true);
    const listo = await preparar(original);
    setWorking(false);
    if (!listo.ok) {
      setError(
        listo.reason === "type"
          ? t(
              "Ese formato no sirve. Usá una foto o captura (JPG, PNG, WEBP) o un PDF.",
              "That format is not supported. Use a photo or screenshot (JPG, PNG, WEBP) or a PDF.",
              "Esse formato não é aceito. Use uma foto ou captura (JPG, PNG, WEBP) ou um PDF.",
            )
          : t(
              "El PDF pesa más de 3 MB. Probá con una captura de pantalla del comprobante.",
              "The PDF is larger than 3 MB. Try a screenshot of the receipt instead.",
              "O PDF tem mais de 3 MB. Tente uma captura de tela do comprovante.",
            ),
      );
      return;
    }
    // Se deja el archivo final dentro del input real para que viaje con el formulario.
    if (input.current !== null) {
      const transfer = new DataTransfer();
      transfer.items.add(listo.file);
      input.current.files = transfer.files;
    }
    setFile(listo.file);
    cambiarVista(listo.file);
    onChange?.(listo.file);
  }

  function quitar() {
    if (input.current !== null) input.current.value = "";
    setFile(null);
    cambiarVista(null);
    setError("");
    onChange?.(null);
  }

  function alPegar(event: React.ClipboardEvent<HTMLDivElement>) {
    const pegado = Array.from(event.clipboardData.files)[0];
    if (pegado !== undefined) {
      event.preventDefault();
      void elegir(pegado);
    }
  }

  const borde = over
    ? "border-accent bg-accent/10"
    : missing && file === null
      ? "border-danger bg-danger/5"
      : "border-border bg-background hover:border-accent/60";

  return (
    <div onPaste={alPegar}>
      <p className="eyebrow">
        {t("Comprobante de pago", "Payment receipt", "Comprovante de pagamento")}{" "}
        <span className="text-accent-contrast">*</span>
      </p>

      {/* El input real queda oculto; la zona entera funciona como botón. */}
      <input
        ref={input}
        id={name}
        name={name}
        type="file"
        accept={PROOF_ACCEPT}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => void elegir(event.target.files?.[0])}
      />

      {file === null ? (
        <label
          htmlFor={name}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            setOver(false);
            void elegir(event.dataTransfer.files[0]);
          }}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              input.current?.click();
            }
          }}
          className={`mt-2 flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed px-4 py-6 text-center transition-colors ${borde} ${disabled ? "cursor-wait opacity-60" : ""}`}
        >
          <span aria-hidden="true" className="text-3xl leading-none text-accent-contrast">
            ⤓
          </span>
          <span className="text-sm font-semibold text-foreground">
            {working
              ? t("Preparando el archivo…", "Preparing the file…", "Preparando o arquivo…")
              : t(
                  "Arrastrá acá el comprobante o tocá para buscarlo",
                  "Drag the receipt here or tap to browse",
                  "Arraste o comprovante aqui ou toque para procurar",
                )}
          </span>
          <span className="text-xs leading-relaxed text-muted">
            {t(
              "Una captura de pantalla o foto de la transferencia sirve. También podés pegarla con Ctrl+V.",
              "A screenshot or photo of the transfer works. You can also paste it with Ctrl+V.",
              "Uma captura ou foto da transferência serve. Você também pode colar com Ctrl+V.",
            )}
          </span>
        </label>
      ) : (
        <div className="mt-2 flex items-center gap-3 border border-accent/60 bg-accent/10 p-3">
          {preview !== null ? (
            // Vista previa local (blob:), no pasa por el optimizador de imágenes.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="h-16 w-16 shrink-0 border border-border object-cover" />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-16 w-16 shrink-0 items-center justify-center border border-border bg-background text-xs font-semibold text-muted"
            >
              PDF
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">✓ {file.name}</p>
            <p className="text-xs text-muted">{tamano(file.size)}</p>
          </div>
          <button
            type="button"
            onClick={quitar}
            disabled={disabled}
            className="min-h-10 shrink-0 border border-border px-3 py-2 text-xs uppercase tracking-wider text-foreground transition-colors hover:border-accent disabled:opacity-60"
          >
            {t("Cambiar", "Change", "Trocar")}
          </button>
        </div>
      )}

      {error !== "" ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          ⚠ {error}
        </p>
      ) : (
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          {t(
            "JPG, PNG, WEBP o PDF. Las fotos grandes se achican solas.",
            "JPG, PNG, WEBP or PDF. Large photos are resized automatically.",
            "JPG, PNG, WEBP ou PDF. Fotos grandes são reduzidas automaticamente.",
          )}
        </p>
      )}
    </div>
  );
}
