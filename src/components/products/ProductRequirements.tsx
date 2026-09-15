import {
  downloadLabel,
  licenseLabel,
  platformsLabel,
} from "@/features/products/format";
import type { Product } from "@/types/product";

interface ProductRequirementsProps {
  readonly product: Product;
}

/**
 * Requisitos e información técnica.
 *
 * Dos tablas de datos, no dos tarjetas decorativas. La de la derecha siempre tiene
 * contenido porque sale de campos obligatorios del modelo; la de requisitos solo
 * aparece si el producto tiene requisitos confirmados: no se completa con supuestos.
 *
 * El `appId` existe en los datos pero no se muestra: es la llave interna con la que
 * se emiten las licencias y al comprador no le aporta nada.
 */
export function ProductRequirements({ product }: ProductRequirementsProps) {
  const tecnica = [
    { label: "Programa", value: product.name },
    { label: "Versión", value: product.version },
    { label: "Sistema", value: platformsLabel(product.platforms) },
    { label: "Licencia", value: licenseLabel(product.licenseType) },
    { label: "Entrega", value: downloadLabel(product.downloadType) },
    { label: "Modelo", value: "Pago único" },
  ];

  return (
    <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
      {product.systemRequirements.length > 0 ? (
        <section aria-labelledby="requisitos">
          <h2 id="requisitos" className="display text-3xl sm:text-4xl">
            Requisitos
          </h2>
          <Tabla filas={product.systemRequirements} />
        </section>
      ) : null}

      <section aria-labelledby="tecnica">
        <h2 id="tecnica" className="display text-3xl sm:text-4xl">
          Información técnica
        </h2>
        <Tabla filas={tecnica} />
      </section>
    </div>
  );
}

function Tabla({
  filas,
}: {
  readonly filas: readonly { readonly label: string; readonly value: string }[];
}) {
  return (
    <dl className="mt-8 border border-border">
      {filas.map((fila) => (
        <div
          key={fila.label}
          className="flex items-baseline justify-between gap-6 border-b border-border px-5 py-4 last:border-0"
        >
          <dt className="eyebrow">{fila.label}</dt>
          <dd className="text-right text-sm text-foreground">{fila.value}</dd>
        </div>
      ))}
    </dl>
  );
}
