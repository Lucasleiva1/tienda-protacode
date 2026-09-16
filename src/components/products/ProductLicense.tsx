import { pick, type Locale } from "@/i18n/shared";

interface ProductLicenseProps {
  /** Excepción a las condiciones generales. `null` cuando aplica la licencia estándar. */
  readonly licenseNote: string | null;
  readonly locale: Locale;
}

const CONDICIONES = [
  "Esta compra otorga una licencia de uso permanente para la versión adquirida.",
  "El producto no utiliza una suscripción mensual.",
  "No incluye futuras versiones o actualizaciones salvo que se indique expresamente.",
] as const;

/**
 * Condiciones de licencia.
 *
 * El texto general vive acá una sola vez y no repetido en cada producto: son las
 * mismas condiciones para todos. Un producto solo agrega algo cuando tiene una
 * excepción real que declarar (`licenseNote`).
 */
export function ProductLicense({ licenseNote, locale }: ProductLicenseProps) {
  return (
    <section aria-labelledby="licencia" className="border border-border bg-surface">
      <div aria-hidden="true" className="h-px bg-accent/70" />

      <div className="p-7 sm:p-9">
        <h2 id="licencia" className="display text-2xl sm:text-3xl">
          {pick(locale, "Licencia de software", "Software license", "Licença de software")}
        </h2>

        <ul className="mt-6 max-w-2xl space-y-3">
          {pick<readonly string[]>(locale, CONDICIONES, ENGLISH_CONDITIONS, PORTUGUESE_CONDITIONS).map((condicion) => (
            <li key={condicion} className="flex gap-3 text-sm leading-relaxed">
              <span aria-hidden="true" className="mt-2 h-px w-4 shrink-0 bg-accent" />
              <span className="text-muted">{condicion}</span>
            </li>
          ))}
        </ul>

        {licenseNote !== null ? (
          <p className="mt-6 max-w-2xl border-l-2 border-accent pl-4 text-sm leading-relaxed text-foreground">
            {licenseNote}
          </p>
        ) : null}
      </div>
    </section>
  );
}

const ENGLISH_CONDITIONS = [
  "This purchase grants a permanent-use license for the version acquired.",
  "The product does not require a monthly subscription.",
  "Future versions or updates are not included unless expressly stated.",
] as const;

const PORTUGUESE_CONDITIONS = [
  "Esta compra concede uma licença de uso permanente para a versão adquirida.",
  "O produto não utiliza assinatura mensal.",
  "Não inclui versões ou atualizações futuras, salvo indicação expressa.",
] as const;
