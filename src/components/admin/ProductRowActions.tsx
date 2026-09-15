"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  archiveAction,
  deleteProductAction,
  featureAction,
  publishAction,
  unarchiveAction,
  unpublishAction,
} from "@/features/admin/product-actions";

interface ProductRowActionsProps {
  readonly id: string;
  readonly nombre: string;
  readonly published: boolean;
  readonly featured: boolean;
  readonly archived: boolean;
}

/**
 * Acciones rápidas de cada programa en el listado.
 *
 * Publicar, ocultar, destacar y archivar sin abrir el formulario. Cada botón espera
 * la respuesta del servidor antes de refrescar la lista: no se dibuja un resultado
 * optimista que después podría no haber ocurrido.
 */
export function ProductRowActions({
  id,
  nombre,
  published,
  featured,
  archived,
}: ProductRowActionsProps) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState("");

  function ejecutar(operacion: () => Promise<{ ok: boolean; message?: string }>) {
    if (pendiente) return;
    setError("");
    startTransition(async () => {
      const resultado = await operacion();
      if (!resultado.ok) {
        setError(resultado.message ?? "No se pudo completar.");
        return;
      }
      router.refresh();
    });
  }

  function eliminar(): void {
    if (!window.confirm(`¿Eliminar definitivamente “${nombre}”? Esta acción no se puede deshacer.`)) {
      return;
    }
    ejecutar(() => deleteProductAction(id));
  }

  const base =
    "border border-border px-2.5 py-1 text-xs uppercase tracking-wider transition-colors disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {archived ? (
        <>
          <button
            type="button"
            disabled={pendiente}
            onClick={() => ejecutar(() => unarchiveAction(id))}
            className={`${base} text-muted hover:border-accent hover:text-foreground`}
          >
            Desarchivar
          </button>
          <button
            type="button"
            disabled={pendiente}
            onClick={eliminar}
            aria-label={`Eliminar definitivamente ${nombre}`}
            className={`${base} border-danger/60 text-danger hover:bg-danger/10`}
          >
            Eliminar definitivamente
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              ejecutar(() => (published ? unpublishAction(id) : publishAction(id)))
            }
            aria-label={`${published ? "Ocultar" : "Publicar"} ${nombre}`}
            className={
              published
                ? `${base} text-muted hover:border-accent hover:text-foreground`
                : `${base} border-accent bg-accent text-accent-foreground hover:bg-accent-contrast`
            }
          >
            {published ? "Ocultar" : "Publicar"}
          </button>

          <button
            type="button"
            disabled={pendiente}
            onClick={() => ejecutar(() => featureAction(id, !featured))}
            aria-pressed={featured}
            aria-label={`${featured ? "Quitar de destacados" : "Destacar"} ${nombre}`}
            className={
              featured
                ? `${base} border-accent-contrast text-accent-contrast`
                : `${base} text-muted hover:border-accent hover:text-foreground`
            }
          >
            {featured ? "★ Destacado" : "☆ Destacar"}
          </button>

          <button
            type="button"
            disabled={pendiente}
            onClick={() => ejecutar(() => archiveAction(id))}
            aria-label={`Archivar ${nombre}`}
            className={`${base} text-muted hover:border-danger/60 hover:text-foreground`}
          >
            Archivar
          </button>
        </>
      )}

      {error !== "" ? (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
