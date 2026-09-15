export function safeNextPath(value: FormDataEntryValue | string | null): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/cuenta";
}
