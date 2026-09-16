import { pick, type Locale } from "@/i18n/shared";
import type { ProductFeature } from "@/types/product";

interface ProductFeaturesProps {
  readonly features: readonly ProductFeature[];
  readonly useCases: readonly string[];
  readonly locale: Locale;
}

/**
 * Funciones principales y casos de uso.
 *
 * Sin íconos: cada función es un renglón con su nombre y una línea que explica para
 * qué sirve, separados por una regla fina. Un ícono genérico al lado de "Dictado a
 * texto" no agrega información, solo ruido.
 *
 * Cada bloque se dibuja solo si tiene datos. Un producto sin funciones cargadas no
 * muestra un encabezado vacío.
 */
export function ProductFeatures({ features, useCases, locale }: ProductFeaturesProps) {
  if (features.length === 0 && useCases.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
      {features.length > 0 ? (
        <div>
          <h2 className="display text-3xl sm:text-4xl">{pick(locale, "Qué incluye", "What is included", "O que inclui")}</h2>

          <dl className="mt-8 border-t border-border">
            {features.map((funcion) => (
              <div
                key={funcion.name}
                className="border-b border-border py-5 sm:flex sm:items-baseline sm:gap-8"
              >
                <dt className="shrink-0 font-semibold sm:w-64">{funcion.name}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-muted sm:mt-0">
                  {funcion.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {useCases.length > 0 ? (
        <div>
          <h2 className="display text-3xl sm:text-4xl">{pick(locale, "Para qué sirve", "What it is for", "Para que serve")}</h2>

          <ul className="mt-8 flex flex-wrap gap-2">
            {useCases.map((caso) => (
              <li
                key={caso}
                className="eyebrow border border-border px-3 py-2 text-foreground"
              >
                {caso}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
