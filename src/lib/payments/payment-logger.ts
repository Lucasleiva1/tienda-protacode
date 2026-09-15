type PaymentLogLevel = "info" | "warn" | "error";
type SafeValue = string | number | boolean | null;

/** Logging estructurado sin emails, URLs, tokens, firmas ni cuerpos de webhook. */
export function paymentLog(
  level: PaymentLogLevel,
  event: string,
  details: Readonly<Record<string, SafeValue>> = {},
): void {
  const entry = JSON.stringify({
    scope: "payments",
    event,
    at: new Date().toISOString(),
    ...details,
  });

  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}
