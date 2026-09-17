/**
 * Número de WhatsApp en formato internacional, solo dígitos.
 *
 * Se toleran espacios, paréntesis, guiones y el signo + para que no sea fácil
 * cargarlo mal. Lo usan tanto el formulario del navegador como el servidor.
 */
export function normalizeWhatsAppNumber(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const digits = value.replace(/\D/g, "");
  return /^\d{8,15}$/.test(digits) ? digits : null;
}
