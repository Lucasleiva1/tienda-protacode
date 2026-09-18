"use server";

import { refresh } from "next/cache";
import { createManualPaymentService } from "@/features/payments/manual-payment-factory";
import type {
  ManualPaymentErrorCode,
  ManualPaymentResult,
} from "@/features/payments/manual-payment-service";
import { inspectPaymentProofFile } from "@/features/payments/payment-proof-storage";
import {
  parseOrderAccessInput,
  resolveOrderAccess,
} from "@/features/purchases/order-access";
import { isManualPaymentMethodId } from "@/features/settings/payment-method-settings";
import { getLocale } from "@/i18n/server";
import { pick, type Locale } from "@/i18n/shared";
import { allowPersistentRequest } from "@/lib/security/persistent-rate-limit";
import type { Order } from "@/types/order";

/**
 * Acciones del comprador sobre su pedido.
 *
 * Cada una resuelve el pedido con su llave (token privado o sesión del dueño) y
 * nada más: el navegador no puede elegir otro pedido, ni un importe, ni un estado.
 */

export type CustomerPaymentActionResult =
  | { readonly ok: true; readonly message: string }
  | { readonly ok: false; readonly message: string };

const NOT_FOUND: readonly [string, string, string] = [
  "No encontramos el pedido. Volvé a abrir tu enlace privado.",
  "We could not find the order. Open your private link again.",
  "Não encontramos o pedido. Abra novamente o seu link privado.",
];

const ERRORS: Record<ManualPaymentErrorCode, readonly [string, string, string]> = {
  ORDER_NOT_FOUND: NOT_FOUND,
  NOT_MANUAL_ORDER: [
    "Este pedido no usa pagos manuales.",
    "This order does not use manual payments.",
    "Este pedido não usa pagamentos manuais.",
  ],
  METHOD_UNAVAILABLE: [
    "Ese medio de pago no está disponible. Elegí otro.",
    "That payment method is not available. Choose another one.",
    "Esse meio de pagamento não está disponível. Escolha outro.",
  ],
  METHOD_REQUIRED: [
    "Elegí primero cómo vas a pagar.",
    "Choose how you will pay first.",
    "Escolha primeiro como vai pagar.",
  ],
  PAYMENT_ALREADY_REPORTED: [
    "Ya informaste el pago y lo estamos verificando.",
    "You already reported the payment and we are verifying it.",
    "Você já informou o pagamento e estamos verificando.",
  ],
  PAYMENT_ALREADY_PAID: [
    "El pago ya fue confirmado.",
    "The payment was already confirmed.",
    "O pagamento já foi confirmado.",
  ],
  PAYMENT_REJECTED: [
    "El pago de este pedido fue rechazado. Escribinos si necesitás ayuda.",
    "The payment for this order was rejected. Contact us if you need help.",
    "O pagamento deste pedido foi recusado. Fale conosco se precisar de ajuda.",
  ],
  ORDER_NOT_PAYABLE: [
    "El pedido ya no admite cambios de pago.",
    "The order no longer accepts payment changes.",
    "O pedido não aceita mais mudanças de pagamento.",
  ],
  ORDER_TOTAL_INVALID: [
    "El total del pedido no es válido.",
    "The order total is not valid.",
    "O total do pedido não é válido.",
  ],
  PAYMENT_RECORD_CONFLICT: [
    "No pudimos registrar el pago. Probá de nuevo en unos minutos.",
    "We could not record the payment. Please try again in a few minutes.",
    "Não foi possível registrar o pagamento. Tente novamente em alguns minutos.",
  ],
};

function failure(locale: Locale, text: readonly [string, string, string]): CustomerPaymentActionResult {
  return { ok: false, message: pick(locale, ...text) };
}

async function authorizedOrder(access: unknown): Promise<Order | null> {
  const parsed = parseOrderAccessInput(access);
  return parsed === null ? null : resolveOrderAccess(parsed);
}

function fromResult(
  locale: Locale,
  result: ManualPaymentResult,
  success: readonly [string, string, string],
): CustomerPaymentActionResult {
  if (!result.ok) return failure(locale, ERRORS[result.code]);
  refresh();
  return { ok: true, message: pick(locale, ...success) };
}

export async function selectPaymentMethodAction(
  access: unknown,
  methodId: unknown,
): Promise<CustomerPaymentActionResult> {
  const locale = await getLocale();
  const order = await authorizedOrder(access);
  if (order === null) return failure(locale, NOT_FOUND);
  if (!isManualPaymentMethodId(methodId)) return failure(locale, ERRORS.METHOD_UNAVAILABLE);
  if (!(await allowPersistentRequest("manual-payment-method", order.id, 30, 10 * 60_000))) {
    return failure(locale, [
      "Cambiaste de medio muchas veces. Esperá unos minutos.",
      "You changed the method many times. Wait a few minutes.",
      "Você mudou de meio muitas vezes. Aguarde alguns minutos.",
    ]);
  }

  const result = await createManualPaymentService().selectMethod(order.id, methodId);
  return fromResult(locale, result, [
    "Medio de pago seleccionado.",
    "Payment method selected.",
    "Meio de pagamento selecionado.",
  ]);
}

async function readProof(formData: FormData, locale: Locale) {
  if (!(formData instanceof FormData)) return { ok: true as const, upload: null };
  const inspected = await inspectPaymentProofFile(formData.get("comprobante"));
  if (inspected === null) return { ok: true as const, upload: null };
  if (!inspected.ok) {
    return {
      ok: false as const,
      result: { ok: false as const, message: pick(locale, inspected.message, "The receipt must be a JPG, PNG or WEBP image, or a PDF, up to 3 MB.", "O comprovante deve ser uma imagem JPG, PNG ou WEBP, ou um PDF, de até 3 MB.") },
    };
  }
  return { ok: true as const, upload: inspected.upload };
}

/** "Ya pagué". Nunca marca el pedido como pagado: lo deja esperando verificación. */
export async function reportPaymentAction(
  access: unknown,
  formData: FormData,
): Promise<CustomerPaymentActionResult> {
  const locale = await getLocale();
  const order = await authorizedOrder(access);
  if (order === null) return failure(locale, NOT_FOUND);
  if (!(await allowPersistentRequest("manual-payment-report", order.id, 10, 10 * 60_000))) {
    return failure(locale, [
      "Demasiados intentos. Esperá unos minutos.",
      "Too many attempts. Wait a few minutes.",
      "Muitas tentativas. Aguarde alguns minutos.",
    ]);
  }

  const proof = await readProof(formData, locale);
  if (!proof.ok) return proof.result;
  // Obligatorio: sin comprobante, el Admin no tiene con qué cruzar el pago.
  if (proof.upload === null) {
    return failure(locale, [
      "Adjuntá el comprobante de la transferencia para avisarnos que pagaste.",
      "Attach the transfer receipt to let us know you paid.",
      "Anexe o comprovante da transferência para nos avisar que pagou.",
    ]);
  }

  const result = await createManualPaymentService().reportPayment(order.id, proof.upload);
  return fromResult(locale, result, [
    "Pago informado. Estamos verificando tu pago.",
    "Payment reported. We are verifying your payment.",
    "Pagamento informado. Estamos verificando seu pagamento.",
  ]);
}

export async function uploadPaymentProofAction(
  access: unknown,
  formData: FormData,
): Promise<CustomerPaymentActionResult> {
  const locale = await getLocale();
  const order = await authorizedOrder(access);
  if (order === null) return failure(locale, NOT_FOUND);
  if (!(await allowPersistentRequest("manual-payment-proof", order.id, 10, 10 * 60_000))) {
    return failure(locale, [
      "Subiste varios archivos seguidos. Esperá unos minutos.",
      "You uploaded several files in a row. Wait a few minutes.",
      "Você enviou vários arquivos seguidos. Aguarde alguns minutos.",
    ]);
  }

  const proof = await readProof(formData, locale);
  if (!proof.ok) return proof.result;
  if (proof.upload === null) {
    return failure(locale, [
      "Elegí un archivo para subir.",
      "Choose a file to upload.",
      "Escolha um arquivo para enviar.",
    ]);
  }

  const result = await createManualPaymentService().attachProof(order.id, proof.upload);
  return fromResult(locale, result, [
    "Comprobante recibido. Lo vamos a revisar junto con el pago.",
    "Receipt received. We will review it together with the payment.",
    "Comprovante recebido. Vamos analisá-lo junto com o pagamento.",
  ]);
}
