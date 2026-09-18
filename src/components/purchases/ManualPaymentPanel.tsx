"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { CopyButton } from "@/components/purchases/CopyButton";
import { ProofDropzone } from "@/components/purchases/ProofDropzone";
import {
  reportPaymentAction,
  selectPaymentMethodAction,
  uploadPaymentProofAction,
  type CustomerPaymentActionResult,
} from "@/features/payments/manual-payment-actions";
import type { OrderAccessInput } from "@/features/purchases/order-access";
import type { PublicPaymentMethod } from "@/features/settings/payment-method-settings";
import { pick, type Locale } from "@/i18n/shared";
import type { ManualPaymentMethodId, ManualPaymentStatus } from "@/types/manual-payment";

export interface ManualPaymentPanelProps {
  readonly access: OrderAccessInput;
  readonly locale: Locale;
  readonly reference: string;
  readonly totalLabel: string;
  readonly status: ManualPaymentStatus;
  readonly selectedMethod: ManualPaymentMethodId | null;
  readonly methodLabel: string | null;
  readonly reportedAtLabel: string | null;
  readonly proofUploaded: boolean;
  readonly rejectionReason: string | null;
  readonly methods: readonly PublicPaymentMethod[];
  readonly whatsappUrl: string | null;
}

export function ManualPaymentPanel(props: ManualPaymentPanelProps) {
  const { locale } = props;
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<CustomerPaymentActionResult | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofMissing, setProofMissing] = useState(false);
  const busy = useRef(false);

  const t = (es: string, en: string, pt: string) => pick(locale, es, en, pt);
  // Con un único medio activo no hay nada que elegir: se muestra directo.
  const onlyMethod = props.methods.length === 1 ? (props.methods[0] ?? null) : null;
  const selected = props.methods.find((method) => method.id === props.selectedMethod) ?? onlyMethod;
  const step = (n: number) => (onlyMethod === null ? n : n - 1);

  function run(task: () => Promise<CustomerPaymentActionResult>) {
    // Candado inmediato: dos toques seguidos no disparan dos solicitudes.
    if (busy.current) return;
    busy.current = true;
    setResult(null);
    startTransition(async () => {
      try {
        setResult(await task());
      } catch {
        setResult({
          ok: false,
          message: t(
            "No pudimos conectar con el servidor. Revisá tu conexión y volvé a intentar.",
            "We could not reach the server. Check your connection and try again.",
            "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
          ),
        });
      } finally {
        busy.current = false;
      }
    });
  }

  /** El comprobante es obligatorio: sin archivo no se envía nada. */
  function requireProof(): boolean {
    if (proofFile !== null) return true;
    setProofMissing(true);
    setResult({
      ok: false,
      message: t(
        "Adjuntá el comprobante de la transferencia para avisarnos que pagaste.",
        "Attach the transfer receipt to let us know you paid.",
        "Anexe o comprovante da transferência para nos avisar que pagou.",
      ),
    });
    return false;
  }

  function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireProof()) return;
    const data = new FormData(event.currentTarget);
    run(() => reportPaymentAction(props.access, data));
  }

  function submitProof(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!requireProof()) return;
    const data = new FormData(event.currentTarget);
    run(() => uploadPaymentProofAction(props.access, data));
  }

  const feedback =
    result === null ? null : (
      <p
        role="status"
        className={`mt-4 border px-4 py-3 text-sm ${result.ok ? "border-accent/50 bg-accent/10" : "border-danger/50 bg-danger/10"}`}
      >
        {result.ok ? "" : "⚠ "}
        {result.message}
      </p>
    );

  const whatsappLink =
    props.whatsappUrl === null ? null : (
      <a
        href={props.whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center justify-center border border-border px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-accent"
      >
        {t("Pagar / consultar por WhatsApp", "Pay / ask via WhatsApp", "Pagar / consultar pelo WhatsApp")}
      </a>
    );

  const proofInput = (
    <ProofDropzone
      name="comprobante"
      locale={locale}
      disabled={pending}
      missing={proofMissing}
      onChange={(file) => {
        setProofFile(file);
        if (file !== null) {
          setProofMissing(false);
          setResult(null);
        }
      }}
    />
  );

  /* ------------------------------ rechazado ------------------------------ */

  if (props.status === "rejected") {
    return (
      <section aria-labelledby="pago-titulo" className="border border-danger/50 bg-surface p-5 sm:p-7">
        <p id="pago-titulo" className="eyebrow text-danger">
          {t("Pago rechazado", "Payment rejected", "Pagamento recusado")}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {t(
            "No pudimos verificar el ingreso de este pago, así que el pedido quedó cerrado. Si pagaste, escribinos con el número de pedido.",
            "We could not verify this payment, so the order was closed. If you paid, contact us with the order number.",
            "Não conseguimos verificar este pagamento, então o pedido foi encerrado. Se você pagou, fale conosco com o número do pedido.",
          )}
        </p>
        {props.rejectionReason !== null ? (
          <p className="mt-3 border border-border bg-background px-4 py-3 text-sm">
            {t("Motivo: ", "Reason: ", "Motivo: ")}
            {props.rejectionReason}
          </p>
        ) : null}
        {whatsappLink !== null ? <div className="mt-5">{whatsappLink}</div> : null}
      </section>
    );
  }

  /* ------------------------- esperando verificación ------------------------- */

  if (props.status === "awaiting_verification") {
    return (
      <section aria-labelledby="pago-titulo" className="border border-accent/50 bg-surface p-5 sm:p-7">
        <p id="pago-titulo" className="eyebrow text-accent-contrast">
          {t("Pago informado", "Payment reported", "Pagamento informado")}
        </p>
        <p className="mt-3 text-base leading-relaxed text-foreground">
          {t(
            "Pago informado. Estamos verificando tu pago. Cuando sea aprobado vas a poder acceder a tu licencia y descarga.",
            "Payment reported. We are verifying your payment. Once approved you will be able to access your license and download.",
            "Pagamento informado. Estamos verificando seu pagamento. Quando for aprovado, você poderá acessar sua licença e o download.",
          )}
        </p>
        <dl className="mt-5 grid gap-px border border-border bg-border sm:grid-cols-3">
          <Info label={t("Medio", "Method", "Meio")} value={props.methodLabel ?? "—"} />
          <Info label={t("Informado", "Reported", "Informado")} value={props.reportedAtLabel ?? "—"} />
          <Info
            label={t("Comprobante", "Receipt", "Comprovante")}
            value={props.proofUploaded ? t("Recibido", "Received", "Recebido") : t("No adjuntado", "Not attached", "Não anexado")}
          />
        </dl>

        <form onSubmit={submitProof} className="mt-6 space-y-3" encType="multipart/form-data">
          {proofInput}
          <button
            type="submit"
            disabled={pending}
            className="min-h-11 border border-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-wait disabled:opacity-60"
          >
            {props.proofUploaded
              ? t("Reemplazar comprobante", "Replace receipt", "Substituir comprovante")
              : t("Subir comprobante", "Upload receipt", "Enviar comprovante")}
          </button>
        </form>
        {feedback}
        {whatsappLink !== null ? <div className="mt-6">{whatsappLink}</div> : null}
      </section>
    );
  }

  /* --------------------------- elegir y pagar --------------------------- */

  return (
    <section aria-labelledby="pago-titulo" className="border border-border bg-surface p-5 sm:p-7">
      {onlyMethod === null ? (
        <p id="pago-titulo" className="eyebrow text-accent-contrast">
          {t("1 · Elegí cómo pagar", "1 · Choose how to pay", "1 · Escolha como pagar")}
        </p>
      ) : null}

      {onlyMethod !== null ? null : props.methods.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted">
          {t(
            "Todavía no hay medios de pago disponibles. Escribinos y lo resolvemos.",
            "No payment methods are available yet. Contact us and we will sort it out.",
            "Ainda não há meios de pagamento disponíveis. Fale conosco e resolvemos.",
          )}
        </p>
      ) : (
        <div role="radiogroup" className="mt-4 grid gap-2 sm:grid-cols-2">
          {props.methods.map((method) => {
            const active = method.id === props.selectedMethod;
            return (
              <button
                key={method.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={pending}
                onClick={() => {
                  if (!active) run(() => selectPaymentMethodAction(props.access, method.id));
                }}
                className={`min-h-12 border px-4 py-3 text-left text-sm font-semibold transition-colors disabled:cursor-wait ${
                  active
                    ? "border-accent bg-accent/15 text-foreground"
                    : "border-border bg-background text-foreground hover:border-accent/60"
                }`}
              >
                <span aria-hidden="true" className="mr-2 inline-block w-4">
                  {active ? "●" : "○"}
                </span>
                {method.name}
              </button>
            );
          })}
        </div>
      )}

      {selected !== null ? (
        <div className={onlyMethod === null ? "mt-7 border-t border-border pt-6" : ""}>
          <p id={onlyMethod === null ? undefined : "pago-titulo"} className="eyebrow text-accent-contrast">
            {`${step(2)} · `}
            {t("Pagá con ", "Pay with ", "Pague com ")}
            {selected.name}
          </p>

          <dl className="mt-4 space-y-4">
            <div>
              <dt className="eyebrow">{t("Total", "Total", "Total")}</dt>
              <dd className="display mt-1 text-4xl">{props.totalLabel}</dd>
            </div>

            <div>
              <dt className="eyebrow">{t("Referencia", "Reference", "Referência")}</dt>
              <dd className="mt-1 flex flex-wrap items-center gap-3">
                <span className="font-semibold">{props.reference}</span>
                <CopyButton
                  value={props.reference}
                  label={t("Copiar", "Copy", "Copiar")}
                  copiedLabel={t("Copiada", "Copied", "Copiada")}
                  failedLabel={t("Copiala a mano.", "Copy it manually.", "Copie manualmente.")}
                />
              </dd>
              <p className="mt-1 text-xs text-muted">
                {t(
                  "Si tu app lo permite, ponela en el concepto o mensaje del pago.",
                  "If your app allows it, add it to the payment note.",
                  "Se o app permitir, coloque-a na descrição do pagamento.",
                )}
              </p>
            </div>

            {selected.alias !== null ? (
              <div>
                <dt className="eyebrow">Alias</dt>
                <dd className="mt-1">
                  <span className="block select-all break-all border border-border bg-background px-4 py-3 text-lg font-semibold tracking-wide">
                    {selected.alias}
                  </span>
                  <CopyButton
                    className="mt-2"
                    value={selected.alias}
                    label={t("Copiar alias", "Copy alias", "Copiar alias")}
                    copiedLabel={t("Alias copiado", "Alias copied", "Alias copiado")}
                    failedLabel={t("Tocalo y copialo a mano.", "Tap it and copy manually.", "Toque e copie manualmente.")}
                  />
                </dd>
              </div>
            ) : null}

            {selected.cvu !== null ? (
              <div>
                <dt className="eyebrow">CVU / CBU</dt>
                <dd className="mt-1">
                  <span className="block select-all break-all border border-border bg-background px-4 py-3 font-mono text-base">
                    {selected.cvu}
                  </span>
                  <CopyButton
                    className="mt-2"
                    value={selected.cvu}
                    label={t("Copiar CVU", "Copy CVU", "Copiar CVU")}
                    copiedLabel={t("CVU copiado", "CVU copied", "CVU copiado")}
                    failedLabel={t("Tocalo y copialo a mano.", "Tap it and copy manually.", "Toque e copie manualmente.")}
                  />
                </dd>
              </div>
            ) : null}

            {selected.holder !== null ? (
              <div>
                <dt className="eyebrow">{t("Titular", "Account holder", "Titular")}</dt>
                <dd className="mt-1 text-sm">{selected.holder}</dd>
              </div>
            ) : null}
          </dl>

          {selected.instructions !== null ? (
            <p className="mt-5 whitespace-pre-line border-l-2 border-accent/60 pl-4 text-sm leading-relaxed text-muted">
              {selected.instructions}
            </p>
          ) : null}

          {selected.qrSrc !== null ? (
            <div className="mt-5">
              <button
                type="button"
                onClick={() => setQrOpen((open) => !open)}
                aria-expanded={qrOpen}
                className="min-h-11 border border-border px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-accent"
              >
                {qrOpen
                  ? t("Ocultar QR", "Hide QR", "Ocultar QR")
                  : t("Ver / escanear QR", "View / scan QR", "Ver / escanear QR")}
              </button>
              {qrOpen ? (
                <Image
                  src={selected.qrSrc}
                  alt={selected.qrAlt ?? `QR ${selected.name}`}
                  width={320}
                  height={320}
                  unoptimized
                  className="mt-3 h-auto w-full max-w-[280px] border border-border bg-white p-3"
                />
              ) : null}
            </div>
          ) : null}

          {selected.kind === "whatsapp" && whatsappLink !== null ? (
            <div className="mt-5">{whatsappLink}</div>
          ) : null}

          <form onSubmit={submitReport} className="mt-7 space-y-4 border-t border-border pt-6" encType="multipart/form-data">
            <p className="eyebrow text-accent-contrast">
              {`${step(3)} · `}
              {t("Después de pagar", "After paying", "Depois de pagar")}
            </p>
            {proofInput}
            <button
              type="submit"
              disabled={pending}
              className="min-h-12 w-full bg-accent px-8 py-4 text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors hover:bg-accent-contrast disabled:cursor-wait disabled:opacity-60 sm:w-auto"
            >
              {pending ? t("Enviando…", "Sending…", "Enviando…") : t("Ya pagué", "I have paid", "Já paguei")}
            </button>
            <p className="text-xs leading-relaxed text-muted">
              {t(
                "Tocalo solo cuando hayas hecho el pago. Tu pedido queda esperando nuestra verificación; no se aprueba automáticamente.",
                "Tap it only after paying. Your order waits for our verification; it is not approved automatically.",
                "Toque somente depois de pagar. Seu pedido aguarda nossa verificação; não é aprovado automaticamente.",
              )}
            </p>
          </form>
        </div>
      ) : null}

      {feedback}

      {whatsappLink !== null && selected?.kind !== "whatsapp" ? (
        <div className="mt-6 border-t border-border pt-5">
          <p className="mb-3 text-xs text-muted">
            {t("¿Preferís coordinar por chat o tenés dudas?", "Prefer to arrange it by chat or have questions?", "Prefere combinar pelo chat ou tem dúvidas?")}
          </p>
          {whatsappLink}
        </div>
      ) : null}
    </section>
  );
}

function Info({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="bg-background p-3">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}
