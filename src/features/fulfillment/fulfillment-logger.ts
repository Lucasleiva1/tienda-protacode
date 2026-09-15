import "server-only";

type FulfillmentEvent =
  | "FULFILLMENT_STARTED"
  | "LICENSE_REQUESTED"
  | "LICENSE_ISSUED"
  | "LICENSE_FAILED"
  | "DOWNLOAD_READY"
  | "ORDER_FULFILLED"
  | "FULFILLMENT_ERROR";

export function fulfillmentLog(
  level: "info" | "warn" | "error",
  event: FulfillmentEvent,
  context: Readonly<Record<string, string | number | boolean | null>>,
): void {
  // El contrato del logger no admite licenseKey, tokens, emails ni secretos.
  const safe = Object.fromEntries(
    Object.entries(context).filter(
      ([key]) => !/licensekey|token|secret|email|authorization/i.test(key),
    ),
  );
  const line = JSON.stringify({ scope: "fulfillment", event, ...safe });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
