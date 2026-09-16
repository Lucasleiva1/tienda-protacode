import { DownloadIcon } from "@/components/ui/Icons";
import { pick, type Locale } from "@/i18n/shared";

interface FreeDownloadButtonProps {
  readonly slug: string;
  /** `false` mientras el Admin todavía no subió el instalador de esta versión. */
  readonly available: boolean;
  readonly locale: Locale;
  readonly className?: string;
}

/**
 * Descarga de un programa gratuito.
 *
 * Es un formulario común: no hay carrito, ni checkout, ni pedido. Va por POST para
 * que la dirección no quede guardada como un enlace de descarga en el historial ni
 * se dispare sola al precargar la página.
 */
export function FreeDownloadButton({
  slug,
  available,
  locale,
  className = "",
}: FreeDownloadButtonProps) {
  if (!available) {
    return (
      <div className={className}>
        <span className="inline-flex items-center justify-center gap-2.5 border border-border px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-muted">
          {pick(locale, "Descarga no disponible", "Download unavailable", "Download indisponível")}
        </span>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          {pick(
            locale,
            "El archivo de esta versión todavía no está cargado. Volvé en unos días.",
            "The file for this version has not been uploaded yet. Check back in a few days.",
            "O arquivo desta versão ainda não foi carregado. Volte em alguns dias.",
          )}
        </p>
      </div>
    );
  }

  return (
    <form method="post" action={`/api/downloads/gratis/${slug}`} className={className}>
      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2.5 bg-accent px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast sm:w-auto"
      >
        <DownloadIcon className="h-4 w-4" />
        {pick(locale, "Descargar gratis", "Download for free", "Baixar grátis")}
      </button>
    </form>
  );
}
