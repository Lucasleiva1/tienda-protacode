"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState, useTransition } from "react";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { EmptyCart } from "@/components/cart/EmptyCart";
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
  readonly paymentEnabled: boolean;
  readonly whatsappRequested: boolean;
  readonly whatsappEnabled: boolean;
  readonly customer: CustomerProfile;
}

function initialValues(customer: CustomerProfile): CheckoutFormValues {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    confirmEmail: customer.email,
    acceptedTerms: false,
  };
}

type Estado = "idle" | "submitting" | "error";

export function CheckoutView({
  catalog,
  currency,
  paymentEnabled,
  whatsappRequested,
  whatsappEnabled,
  customer,
}: CheckoutViewProps) {
  const hidratado = useCartHydrated();
  const lineas = useCartSlugs();
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

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

  const resolucion = useMemo(
    () => resolveCart(lineas.map((l) => l.slug), catalog, currency),
    [lineas, catalog, currency],
  );

  if (!hidratado) {
    return (
      <div aria-busy="true" className="h-64 border border-border bg-surface">
        <span className="sr-only">Cargando tu compra…</span>
      </div>
    );
  }

  const productos = resolucion.products;

  if (productos.length === 0) {
    return <EmptyCart />;
  }

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

    const validacion = validateCheckout(valores);
    if (!validacion.ok) {
      setErrores(validacion.errors);
      setEstado("error");
      setMensaje("Revisá los datos marcados.");
      return;
    }

    enviandoRef.current = true;
    setErrores({});
    setMensaje("");
    setEstado("submitting");

    startTransition(async () => {
      const resultado = await createOrderAction({
        values: valores,
        slugs: productos.map((producto) => producto.slug),
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
      setMensaje(resultado.message ?? "Revisá los datos marcados.");
    });
  }

  const enviando = pendiente || estado === "submitting";

  return (
    <form onSubmit={enviar} noValidate>
      <div className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-14">
        <div>
          <fieldset disabled={enviando} className="border-0 p-0">
            <legend className="eyebrow text-accent-contrast">Tus datos</legend>

            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
              Solo pedimos lo necesario para identificar tu compra y enviarte el
              programa.
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <Campo
                id={`${ids}-nombre`}
                label="Nombre"
                value={valores.firstName}
                error={errores.firstName}
                autoComplete="given-name"
                readOnly
                onChange={(v) => actualizar("firstName", v)}
              />
              <Campo
                id={`${ids}-apellido`}
                label="Apellido"
                value={valores.lastName}
                error={errores.lastName}
                autoComplete="family-name"
                readOnly
                onChange={(v) => actualizar("lastName", v)}
              />
              <Campo
                id={`${ids}-email`}
                label="Email"
                type="email"
                value={valores.email}
                error={errores.email}
                autoComplete="email"
                readOnly
                onChange={(v) => actualizar("email", v)}
              />
              <Campo
                id={`${ids}-email2`}
                label="Repetí tu email"
                type="email"
                value={valores.confirmEmail}
                error={errores.confirmEmail}
                autoComplete="off"
                readOnly
                onChange={(v) => actualizar("confirmEmail", v)}
              />
            </div>

            <div className="mt-10 border-t border-border pt-8">
              <p className="eyebrow text-accent-contrast">Condiciones</p>

              <label
                htmlFor={`${ids}-terminos`}
                className="mt-5 flex cursor-pointer items-start gap-3"
              >
                <input
                  id={`${ids}-terminos`}
                  type="checkbox"
                  checked={valores.acceptedTerms}
                  onChange={(e) => actualizar("acceptedTerms", e.target.checked)}
                  aria-invalid={errores.acceptedTerms !== undefined}
                  aria-describedby={
                    errores.acceptedTerms !== undefined
                      ? `${ids}-terminos-error`
                      : undefined
                  }
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="text-sm leading-relaxed text-muted">
                  Entiendo que estoy comprando una licencia de uso permanente para la
                  versión indicada del software, y que no se incluyen futuras
                  actualizaciones salvo que se indique expresamente.
                </span>
              </label>

              {errores.acceptedTerms !== undefined ? (
                <p
                  id={`${ids}-terminos-error`}
                  className="mt-2 text-sm text-danger"
                >
                  ⚠ {errores.acceptedTerms}
                </p>
              ) : null}
            </div>
          </fieldset>

          <div aria-live="polite" className="mt-8">
            {estado === "error" && mensaje !== "" ? (
              <p className="border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-foreground">
                ⚠ {mensaje}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="mt-6 w-full bg-accent px-8 py-4 text-sm font-semibold uppercase tracking-[0.1em] text-accent-foreground transition-colors hover:bg-accent-contrast disabled:cursor-wait disabled:border disabled:border-border disabled:bg-transparent disabled:text-muted sm:w-auto"
          >
            {enviando
              ? "Preparando el pedido…"
              : whatsappRequested
                ? "Pedir por WhatsApp"
                : paymentEnabled
                  ? "Continuar al pago"
                  : "Crear pedido"}
          </button>

          <p className="mt-4 text-xs leading-relaxed text-muted">
            {whatsappRequested
              ? whatsappEnabled
                ? "Guardaremos el pedido y abriremos WhatsApp con el detalle listo para coordinar el pago y la entrega. El mensaje no se envía hasta que vos lo confirmes."
                : "La atención por WhatsApp todavía no está disponible. No se creará ningún pedido hasta que el canal esté configurado."
              : paymentEnabled
                ? "El total se vuelve a validar en el servidor antes de continuar al medio de pago."
                : "El medio de pago todavía no está configurado. El pedido quedará pendiente y no se te cobrará nada."}
          </p>

          <Link
            href="/carrito"
            className="mt-8 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
          >
            <ArrowIcon className="h-4 w-4 rotate-180" />
            Volver al carrito
          </Link>
        </div>

        <CheckoutSummary products={productos} subtotal={resolucion.subtotal} />
      </div>
    </form>
  );
}

interface CampoProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly error?: string | undefined;
  readonly type?: string;
  readonly autoComplete?: string;
  readonly readOnly?: boolean;
  readonly onChange: (valor: string) => void;
}

/** Campo de texto con su error asociado. El error no depende solo del color. */
function Campo({
  id,
  label,
  value,
  error,
  type = "text",
  autoComplete,
  readOnly = false,
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
        autoComplete={autoComplete}
        readOnly={readOnly}
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
      ) : null}
    </div>
  );
}
