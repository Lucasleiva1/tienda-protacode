"use client";

import { useState, useTransition } from "react";
import {
  associateProductDownloadAction,
  removeProductDownloadAction,
} from "@/features/admin/download-actions";
import type { ProductDownload } from "@/types/download";

interface Props {
  readonly productId: string;
  readonly version: string;
  readonly download: ProductDownload | null;
}

const CONTENT_TYPES = [
  "application/vnd.microsoft.portable-executable",
  "application/x-msi",
  "application/zip",
  "application/x-apple-diskimage",
  "application/vnd.android.package-archive",
] as const;

export function ProductDownloadPanel({ productId, version, download }: Props) {
  const [pending, startTransition] = useTransition();
  const [storageKey, setStorageKey] = useState(download?.file.storageKey ?? "");
  const [fileName, setFileName] = useState(download?.file.fileName ?? "");
  const [contentType, setContentType] = useState(
    download?.file.contentType ?? "application/zip",
  );
  const [size, setSize] = useState(download === null ? "" : String(download.file.size));
  const [sha256, setSha256] = useState(download?.file.sha256 ?? "");
  const [uploadedAt, setUploadedAt] = useState(
    download?.file.uploadedAt ?? new Date().toISOString(),
  );
  const [message, setMessage] = useState("");

  function save(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setMessage("");
    startTransition(async () => {
      const result = await associateProductDownloadAction(productId, version, {
        storageKey,
        fileName,
        contentType,
        size: Number(size),
        sha256,
        uploadedAt,
      });
      setMessage(result.message);
    });
  }

  function remove(): void {
    setMessage("");
    startTransition(async () => {
      const result = await removeProductDownloadAction(productId, version);
      setMessage(result.message);
      if (result.ok) {
        setStorageKey("");
        setFileName("");
        setSize("");
        setSha256("");
      }
    });
  }

  return (
    <section className="mt-8 border border-border bg-surface p-5 sm:p-6">
      <p className="eyebrow text-accent-contrast">Archivo instalable privado</p>
      <h2 className="display mt-3 text-3xl">Entrega de la versión {version}</h2>

      <div className="mt-4 border border-border bg-background p-4 text-sm leading-relaxed text-muted">
        <p>
          Los instaladores grandes no se suben mediante una Function: Netlify limita
          el payload binario de entrada a unos 4,5 MB. Subí el archivo al store privado
          con Netlify CLI y asociá aquí su metadata.
        </p>
        <code className="mt-3 block overflow-x-auto whitespace-nowrap text-xs text-foreground">
          netlify blobs:set prota-code-downloads &quot;products/{productId}/{version}/archivo-v{version}.zip&quot; --input &quot;ruta-del-archivo&quot;
        </code>
      </div>

      {download !== null ? (
        <dl className="mt-5 grid gap-3 border-y border-border py-4 text-sm sm:grid-cols-2">
          <Info label="Nombre" value={download.file.fileName} />
          <Info label="Tamaño" value={`${(download.file.size / 1024 / 1024).toFixed(1)} MB`} />
          <Info label="Actualizado" value={new Date(download.updatedAt).toLocaleString("es-AR")} />
          <Info label="Estado" value="Asociado al Blob privado" />
        </dl>
      ) : null}

      <form onSubmit={save} className="mt-6 grid gap-4 lg:grid-cols-2">
        <Field label="Blob key" value={storageKey} onChange={setStorageKey} />
        <Field label="Nombre versionado" value={fileName} onChange={setFileName} />
        <label className="block">
          <span className="eyebrow">Content-Type</span>
          <select
            value={contentType}
            onChange={(event) => setContentType(event.target.value)}
            className="mt-1.5 w-full border border-border bg-background px-3 py-2 text-sm text-foreground"
          >
            {CONTENT_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <Field label="Tamaño exacto en bytes" value={size} onChange={setSize} />
        <Field label="SHA-256" value={sha256} onChange={setSha256} />
        <Field label="Fecha ISO de carga" value={uploadedAt} onChange={setUploadedAt} />

        <div className="flex flex-wrap gap-3 lg:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent-foreground disabled:opacity-50"
          >
            {pending ? "Verificando…" : "Asociar y verificar"}
          </button>
          {download !== null ? (
            <button
              type="button"
              disabled={pending}
              onClick={remove}
              className="border border-danger/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground disabled:opacity-50"
            >
              Retirar asociación
            </button>
          ) : null}
        </div>
      </form>

      <p aria-live="polite" className="mt-4 text-sm text-muted">{message}</p>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 w-full border border-border bg-background px-3 py-2 text-sm text-foreground"
      />
    </label>
  );
}

function Info({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 break-all text-foreground">{value}</dd>
    </div>
  );
}
