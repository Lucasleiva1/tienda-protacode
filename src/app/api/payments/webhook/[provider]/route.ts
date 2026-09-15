import { createPaymentService } from "@/features/payments/payment-service";
import { getRegisteredPaymentGateway } from "@/lib/payments/gateway-registry";
import { paymentLog } from "@/lib/payments/payment-logger";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/payments/webhook/[provider]">,
) {
  const { provider } = await context.params;
  const gateway = getRegisteredPaymentGateway(provider);

  paymentLog("info", "WEBHOOK_RECEIVED", { provider });

  if (gateway === null) {
    return Response.json({ ok: false, error: "PAYMENT_PROVIDER_UNKNOWN" }, { status: 404 });
  }
  if (gateway.verifyWebhook === undefined) {
    return Response.json(
      { ok: false, error: "PAYMENT_WEBHOOK_NOT_SUPPORTED" },
      { status: 501 },
    );
  }

  let event;
  try {
    // El Request no se consume antes: el adapter necesita el cuerpo RAW para la firma.
    event = await gateway.verifyWebhook(request);
  } catch {
    paymentLog("warn", "PAYMENT_WEBHOOK_INVALID", { provider });
    return Response.json({ ok: false, error: "PAYMENT_WEBHOOK_INVALID" }, { status: 401 });
  }

  try {
    const result = await createPaymentService(gateway).processVerifiedEvent(event);
    // Un evento auténtico pero no aplicable se acusa recibo para evitar reintentos eternos.
    return Response.json({ ok: true, processed: result.ok, result });
  } catch {
    paymentLog("error", "PAYMENT_WEBHOOK_PROCESSING_ERROR", {
      provider,
      eventId: event.eventId,
      orderId: event.orderId,
    });
    return Response.json(
      { ok: false, error: "PAYMENT_WEBHOOK_PROCESSING_ERROR" },
      { status: 503 },
    );
  }
}
