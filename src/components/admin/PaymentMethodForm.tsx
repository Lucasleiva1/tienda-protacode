"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  savePaymentMethodAction,
  uploadPaymentQrAction,
} from "@/features/admin/payment-method-actions";
import type {
  PaymentMethodErrors,
  PaymentMethodField,
} from "@/features/settings/payment-method-settings";
import type { PaymentMethodSettings } from "@/types/manual-payment";

/** Edición de un medio de pago manual. Los datos se validan otra vez en el servidor. */
export function PaymentMethodForm({ method }: { readonly method: PaymentMethodSettings }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<PaymentMethodErrors>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [values, setValues] = useState({
    name: method.name,
    active: method.active,
    alias: method.alias ?? "",
    cvu: method.cvu ?? "",
    holder: method.holder ?? "",
    instructions: method.instructions ?? "",
    qr: method.qr,
  });
  const transfer = method.kind === "transfer";
  const id = `metodo-${method.id}`;

  function update<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((previous) => ({ ...previous, [key]: value }));
    setErrors((previous) => ({ ...previous, [key as PaymentMethodField]: undefined }));
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await savePaymentMethodAction(method.id, values);
      setErrors(result.ok ? {} : result.errors ?? {});
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) router.refresh();
    });
  }

  async function upload(file: File) {
    setUploading(true);
    setMessage(null);
    const data = new FormData();
    data.append("archivo", file);
    const result = await uploadPaymentQrAction(method.id, data);
    setUploading(false);
    if (!result.ok) {
      setMessage({ ok: false, text: result.message });
      return;
    }
    update("qr", { src: result.url, alt: `QR de pago de ${values.name}` });
    setMessage({ ok: true, text: "QR subido. Guardá para publicarlo." });
  }

  return (
    <form onSubmit={save} noValidate className="border border-border bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="display text-2xl">{method.name}</h2>
        <label htmlFor={`${id}-activo`} className="flex min-h-10 cursor-pointer items-center gap-2 text-sm">
          <input
            id={`${id}-activo`}
            type="checkbox"
            checked={values.active}
            onChange={(event) => update("active", event.target.checked)}
            className="h-5 w-5 accent-[var(--accent)]"
          />
          {values.active ? "Activo" : "Inactivo"}
        </label>
      </div>
      {errors.active !== undefined ? <p className="mt-1 text-sm text-danger">{errors.active}</p> : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-nombre`} label="Nombre visible" value={values.name} error={errors.name} onChange={(v) => update("name", v)} />
        {transfer ? (
          <>
            <Field id={`${id}-alias`} label="Alias" value={values.alias} error={errors.alias} placeholder="MI.ALIAS.PREX" onChange={(v) => update("alias", v)} />
            <Field id={`${id}-cvu`} label="CVU / CBU (opcional)" value={values.cvu} error={errors.cvu} inputMode="numeric" onChange={(v) => update("cvu", v)} />
            <Field id={`${id}-titular`} label="Titular (opcional)" value={values.holder} error={errors.holder} onChange={(v) => update("holder", v)} />
          </>
        ) : null}
      </div>

      <div className="mt-4">
        <label htmlFor={`${id}-instrucciones`} className="eyebrow">
          Instrucciones para el cliente (opcional)
        </label>
        <textarea
          id={`${id}-instrucciones`}
          value={values.instructions}
          rows={3}
          maxLength={600}
          onChange={(event) => update("instructions", event.target.value)}
          className="mt-1.5 w-full border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
        />
        {errors.instructions !== undefined ? <p className="mt-1 text-sm text-danger">{errors.instructions}</p> : null}
      </div>

      {transfer ? (
        <div className="mt-4">
          <p className="eyebrow">QR (opcional)</p>
          {values.qr !== null ? (
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <Image
                src={values.qr.src}
                alt={values.qr.alt}
                width={160}
                height={160}
                unoptimized
                className="h-40 w-40 border border-border bg-white object-contain p-2"
              />
              <button
                type="button"
                onClick={() => update("qr", null)}
                className="min-h-10 border border-border px-3 py-2 text-xs uppercase tracking-wider text-muted hover:text-foreground"
              >
                Quitar QR
              </button>
            </div>
          ) : null}
          <label
            htmlFor={`${id}-qr`}
            className="mt-2 inline-flex min-h-10 cursor-pointer items-center border border-accent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-foreground hover:bg-accent hover:text-accent-foreground"
          >
            {uploading ? "Subiendo…" : values.qr === null ? "Subir QR" : "Cambiar QR"}
          </label>
          <input
            id={`${id}-qr`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={uploading}
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file !== undefined) void upload(file);
            }}
          />
          {errors.qr !== undefined ? <p className="mt-1 text-sm text-danger">{errors.qr}</p> : null}
        </div>
      ) : (
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Este medio abre WhatsApp con el pedido, el producto y el precio ya escritos. El número se configura abajo.
        </p>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || uploading}
          className="min-h-11 bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent-foreground disabled:opacity-50"
        >
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {message !== null ? (
          <p aria-live="polite" className={`text-sm ${message.ok ? "text-foreground" : "text-danger"}`}>
            {message.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  error,
  placeholder,
  inputMode,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly error?: string | undefined;
  readonly placeholder?: string;
  readonly inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  readonly onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error !== undefined}
        className={`mt-1.5 w-full border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none ${error !== undefined ? "border-danger" : "border-border focus:border-accent"}`}
      />
      {error !== undefined ? <p className="mt-1 text-sm text-danger">{error}</p> : null}
    </div>
  );
}
