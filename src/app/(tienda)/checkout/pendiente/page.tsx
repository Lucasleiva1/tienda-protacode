import { redirect } from "next/navigation";

/** Compatibilidad con la URL de Parte 5. No interpreta estados del navegador. */
export default async function PedidoPendienteLegacyPage({
  searchParams,
}: PageProps<"/checkout/pendiente">) {
  const params = await searchParams;
  const id = typeof params.pedido === "string" ? params.pedido : "";
  redirect(`/pago/pendiente?pedido=${encodeURIComponent(id)}`);
}
