"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, useTransition } from "react";
import { GoogleSignInButton } from "@/components/account/GoogleSignInButton";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { EmptyCart } from "@/components/cart/EmptyCart";
import { pick, type Locale } from "@/i18n/shared";
import { ArrowIcon } from "@/components/ui/Icons";
import { createOrderAction } from "@/features/checkout/create-order";
import {
  validateCheckout,
  type CheckoutErrors,
  type CheckoutFormValues,
} from "@/features/checkout/checkout-validation";
import { resolveCart } from "@/features/cart/cart-resolve";
import { useCartHydrated, useCartSlugs } from "@/features/cart/cart-store";
import type { Currency, Product } from "@/types/product";
import type { CustomerProfile } from "@/types/customer-account";

interface CheckoutViewProps {
  readonly catalog: readonly Product[];
  readonly currency: Currency;
  /** Compra directa desde la ficha: se usan estos productos y no el carrito. */
  readonly directProducts?: readonly Product[] | null;
  readonly customer: CustomerProfile | null;
  readonly locale: Locale;
  readonly paymentMode: "manual" | "gateway";
  readonly googleReady: boolean;
  readonly googleFallbackHref: string | null;
  /** Ruta actual, para volver después de iniciar sesión. */
  readonly returnPath: string;
  readonly backHref: string;
  readonly backLabel: string;
}

function initialValues(customer: CustomerProfile | null): CheckoutFormValues {
  const account = customer !== null && customer.emailVerified ? customer : null;
  return {
    firstName: account?.firstName ?? "",
    lastName: account?.lastName ?? "",
    email: account?.email ?? "",
    confirmEmail: account?.email ?? "",
    whatsapp: "",
    acceptedTerms: false,
  };
}

type Estado = "idle" | "submitting" | "error";

export function CheckoutView({
  catalog,
  currency,
  directProducts = null,
  customer,
  locale,
  paymentMode,
  googleReady,
  googleFallbackHref,
  returnPath,
  backHref,
  backLabel,
}: CheckoutViewProps) {
  const hidratado = useCartHydrated();
  const lineas = useCartSlugs();
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  const accountMode = customer !== null && customer.emailVerified;
  const [guestChosen, setGuestChosen] = useState(customer !== null && !customer.emailVerified);
  const [valores, setValores] = useState<CheckoutFormValues>(() => initialValues(customer));
  const [errores, setErrores] = useState<CheckoutErrors>({});
  const [mensaje, setMensaje] = useState("");
  const [estado, setEstado] = useState<Estado>("idle");

  /*
    Candado contra el doble envío.

    No alcanza con `isPending` ni con el `disabled` del botón: los dos se actualizan
    recién en el siguiente render, así que tres clics seguidos en el mismo instante
    pasarían la guarda y crearían tres pedidos. Un ref cambia YA, en la misma vuelta.
  */
  const enviandoRef = useRef(false);

  const ids = useId();
  const t = (es: string, en: string, pt: string) => pick(locale, es, en, pt);

  const resolucion = useMemo(
    () =>
      resolveCart(
        directProducts !== null ? directProducts.map((p) => p.slug) : lineas.map((l) => l.slug),
        directProducts ?? catalog,
        currency,
      ),
    [directProducts, lineas, catalog, currency],
  );

  if (directProducts === null && !hidratado) {
    return (
      <div aria-busy="true" className="h-64 border border-border bg-surface">
        <span className="sr-only">{t("Cargando tu compra…", "Loading your purchase…", "Carregando sua compra…")}</span>
      </div>
    );
  }

  const productos = resolucion.products;

  if (productos.length === 0) {
    return <EmptyCart locale={locale} />;
  }

  const showForm = accountMode || guestChosen;

  function actualizar<K extends keyof CheckoutFormValues>(
    campo: K,
    valor: CheckoutFormValues[K],
  ) {
    setValores((previos) => ({ ...previos, [campo]: valor }));
    // El error del campo se borra apenas se lo toca: no se regaña mientras escribe.
    setErrores((previos) => ({ ...previos, [campo]: undefined }));
  }

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoRef.current || pendiente) return;

    const validacion = validateCheckout(valores, locale);
    if (!validacion.ok) {
      setErrores(validacion.errors);
      setEstado("error");
      setMensaje(t("Revisá los datos marcados.", "Check the highlighted fields.", "Revise os campos destacados."));
      return;
    }

    enviandoRef.current = true;
    setErrores({});
    setMensaje("");
    setEstado("submitting");

    startTransition(async () => {
      try {
        const resultado = await createOrderAction({
          values: valores,
          slugs: productos.map((producto) => producto.slug),
          mode: accountMode ? "account" : "guest",
        });

        if (resultado.ok) {
          // El carrito NO se vacía: el pedido todavía no está pagado.
          // El candado queda cerrado a propósito: ya estamos navegando.
          if (resultado.checkoutUrl !== null) {
            if (/^https?:\/\//i.test(resultado.checkoutUrl)) {
              window.location.assign(resultado.checkoutUrl);
            } else {
              router.push(resultado.checkoutUrl);
            }
          } else {
            router.push(`/pago/pendiente?pedido=${resultado.orderId}`);
          }
          return;
        }

        // Falló: se libera el candado para que pueda corregir y reintentar.
        enviandoRef.current = false;
        setEstado("error");
        if (resultado.errors !== undefined) setErrores(resultado.errors);
        setMensaje(resultado.message ?? t("Revisá los datos marcados.", "Check the highlighted fields.", "Revise os campos destacados."));
      } catch {
        enviandoRef.current = false;
        setEstado("error");
        setMensaje(t("No pudimos conectar con el servidor. Revisá tu conexión e intentá de nuevo.", "We could not reach the server. Check your connection and try again.", "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente."));
      }
    });
  }

  const enviando = pendiente || estado === "submitting";

  return (
    <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-14">
      <div>
        {accountMode ? (
          <div className="border border-accent/50 bg-accent/10 px-5 py-4">
            <p className="eyebrow text-accent-contrast">{t("Tu cuenta", "Your account", "Sua conta")}</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground">
              {t("Esta compra quedará asociada a:", "This purchase will be linked to:", "Esta compra ficará vinculada a:")}{" "}
              <strong className="break-all">{customer?.email}</strong>
            </p>
            <p className="mt-1 text-xs text-muted">
              {t("La vas a encontrar en Mis compras.", "You will find it in My purchases.", "Você a encontrará em Minhas compras.")}
            </p>
          </div>
        ) : (
          <section aria-labelledby={`${ids}-acceso`} className="border border-border bg-surface p-5 sm:p-6">
            <h2 id={`${ids}-acceso`} className="eyebrow text-accent-contrast">
              {t("¿Cómo querés continuar?", "How do you want to continue?", "Como você quer continuar?")}
            </h2>
            {customer !== null && !customer.emailVerified ? (
              <p className="mt-3 text-sm leading-relaxed text-muted">
                {t(
                  "Tu cuenta todavía no confirmó el email. Podés confirmarlo desde Mi cuenta para guardar la compra ahí, o seguir como invitado.",
                  "Your account email is not confirmed yet. Confirm it from My account to keep the purchase there, or continue as a guest.",
                  "O e-mail da sua conta ainda não foi confirmado. Confirme em Minha conta para guardar a compra lá, ou continue como convidado.",
                )}
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {googleReady || googleFallbackHref !== null ? (
                  googleReady ? (
                    <GoogleSignInButton next={returnPath} locale={locale} fallbackHref={googleFallbackHref} />
                  ) : (
                    <a
                      href={googleFallbackHref ?? "#"}
                      className="block w-full border border-border bg-background px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-accent"
                    >
                      {t("Continuar con Google", "Continue with Google", "Continuar com o Google")}
                    </a>
                  )
                ) : null}
                <Link
                  href={`/cuenta/iniciar-sesion?next=${encodeURIComponent(returnPath)}`}
                  className="block w-full border border-border bg-background px-6 py-3 text-center text-sm font-semibold uppercase tracking-[0.08em] text-foreground transition-colors hover:border-accent"
                >
                  {t("Ingresar con email", "Sign in with email", "Entrar com e-mail")}
                </Link>
              </div>
            )}

            {!guestChosen ? (
              <>
                <div className="my-5 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="eyebrow">{t("o", "or", "ou")}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <button
                  type="button"
                  onClick={() => setGuestChosen(true)}
                  className="w-full bg-accent px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast"
                >
                  {t("Continuar como invitado", "Continue as a guest", "Continuar como convidado")}
                </button>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  {t(
                    "Sin cuenta: te damos un enlace privado para ver el pedido, la licencia y la descarga.",
                    "No account needed: you get a private link to view the order, license and download.",
                    "Sem conta: você recebe um link privado para ver o pedido, a licença e o download.",
                  )}
                </p>
              </>
            ) : null}
          </section>
        )}

        {showForm ? (
          <form onSubmit={enviar} noValidate className="mt-8">
            <fieldset disabled={enviando} className="border-0 p-0">
              <legend className="eyebrow text-accent-contrast">
                {accountMode ? t("Contacto (opcional)", "Contact (optional)", "Contato (opcional)") : t("Tus datos", "Your details", "Seus dados")}
              </legend>

              {!accountMode ? (
                <>
                  <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
                    {t("Solo pedimos lo necesario para identificar tu compra y enviarte el programa.", "We only ask for what is needed to identify your purchase and send you the program.", "Pedimos apenas o necessário para identificar sua compra e enviar o programa.")}
                  </p>
                  <div className="mt-6 grid gap-6 sm:grid-cols-2">
                    <Campo id={`${ids}-nombre`} label={t("Nombre", "First name", "Nome")} value={valores.firstName} error={errores.firstName} autoComplete="given-name" onChange={(v) => actualizar("firstName", v)} />
                    <Campo id={`${ids}-apellido`} label={t("Apellido", "Last name", "Sobrenome")} value={valores.lastName} error={errores.lastName} autoComplete="family-name" onChange={(v) => actualizar("lastName", v)} />
                    <Campo id={`${ids}-email`} label={t("Email", "Email", "E-mail")} type="email" value={valores.email} error={errores.email} autoComplete="email" onChange={(v) => actualizar("email", v)} />
                    <Campo id={`${ids}-email2`} label={t("Repetí tu email", "Repeat your email", "Repita seu e-mail")} type="email" value={valores.confirmEmail} error={errores.confirmEmail} autoComplete="off" onChange={(v) => actualizar("confirmEmail", v)} />
                  </div>
                </>
              ) : null}

              <div className="mt-6 max-w-md">
                <Campo
                  id={`${ids}-whatsapp`}
                  label={t("WhatsApp (opcional)", "WhatsApp (optional)", "WhatsApp (opcional)")}
                  type="tel"
                  inputMode="tel"
                  value={valores.whatsapp}
                  error={errores.whatsapp}
                  autoComplete="tel"
                  help={t("Con código de país. Lo usamos solo si hace falta contactarte por el pedido.", "With country code. We only use it if we need to contact you about the order.", "Com código do país. Usamos apenas se precisarmos falar sobre o pedido.")}
                  onChange={(v) => actualizar("whatsapp", v)}
                />
              </div>

              <div className="mt-10 border-t border-border pt-8">
                <p className="eyebrow text-accent-contrast">{t("Condiciones", "Terms", "Condições")}</p>

                <label htmlFor={`${ids}-terminos`} className="mt-5 flex cursor-pointer items-start gap-3">
                  <input
                    id={`${ids}-terminos`}
                    type="checkbox"
                    checked={valores.acceptedTerms}
                    onChange={(e) => actualizar("acceptedTerms", e.target.checked)}
                    aria-invalid={errores.acceptedTerms !== undefined}
                    aria-describedby={errores.acceptedTerms !== undefined ? `${ids}-terminos-error` : undefined}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="text-sm leading-relaxed text-muted">
                    {t("Entiendo que estoy comprando una licencia de uso permanente para la versión indicada del software, y que no se incluyen futuras actualizaciones salvo que se indique expresamente.", "I understand that I am buying a permanent-use license for the indicated version of the software, and that future updates are not included unless expressly stated.", "Entendo que estou comprando uma licença de uso permanente para a versão indicada do software e que atualizações futuras não estão incluídas, salvo indicação expressa.")}
                  </span>
                </label>

                {errores.acceptedTerms !== undefined ? (
                  <p id={`${ids}-terminos-error`} className="mt-2 text-sm text-danger">
                    ⚠ {errores.acceptedTerms}
                  </p>
                ) : null}
              </div>
            </fieldset>

            <div aria-live="polite" className="mt-8">
              {estado === "error" && mensaje !== "" ? (
                <p className="border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-foreground">⚠ {mensaje}</p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="mt-6 min-h-12 w-full bg-accent px-8 py-4 text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors hover:bg-accent-contrast disabled:cursor-wait disabled:border disabled:border-border disabled:bg-transparent disabled:text-muted sm:w-auto"
            >
              {enviando
                ? t("Preparando el pedido…", "Preparing your order…", "Preparando o pedido…")
                : t("Continuar al pago", "Continue to payment", "Continuar para o pagamento")}
            </button>

            <p className="mt-4 text-xs leading-relaxed text-muted">
              {paymentMode === "manual"
                ? t("En el paso siguiente elegís Prex, Ualá, transferencia/QR o WhatsApp. El precio se vuelve a calcular en el servidor y no se te cobra nada todavía.", "Next you choose Prex, Ualá, bank transfer/QR or WhatsApp. The price is recalculated on the server and you are not charged yet.", "Na próxima etapa você escolhe Prex, Ualá, transferência/QR ou WhatsApp. O preço é recalculado no servidor e nada é cobrado ainda.")
                : t("El total se vuelve a validar en el servidor antes de continuar al medio de pago.", "The total is validated again on the server before continuing to payment.", "O total é validado novamente no servidor antes de seguir para o pagamento.")}
            </p>
          </form>
        ) : null}

        <Link
          href={backHref}
          className="mt-8 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          <ArrowIcon className="h-4 w-4 rotate-180" />
          {backLabel}
        </Link>
      </div>

      <CheckoutSummary products={productos} subtotal={resolucion.subtotal} locale={locale} />
    </div>
  );
}

interface CampoProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly error?: string | undefined;
  readonly help?: string;
  readonly type?: string;
  readonly inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  readonly autoComplete?: string;
  readonly onChange: (valor: string) => void;
}

/** Campo de texto con su error asociado. El error no depende solo del color. */
function Campo({
  id,
  label,
  value,
  error,
  help,
  type = "text",
  inputMode,
  autoComplete,
  onChange,
}: CampoProps) {
  const idError = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? idError : undefined}
        className={`mt-2 w-full border bg-background px-4 py-3 text-base text-foreground focus:outline-none ${
          error !== undefined
            ? "border-danger focus:border-danger"
            : "border-border focus:border-accent"
        }`}
      />
      {error !== undefined ? (
        <p id={idError} className="mt-2 text-sm text-danger">
          ⚠ {error}
        </p>
      ) : help !== undefined ? (
        <p className="mt-1.5 text-xs text-muted">{help}</p>
      ) : null}
    </div>
  );
}
