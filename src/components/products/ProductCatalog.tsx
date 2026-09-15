"use client";

import { useId, useMemo, useState } from "react";
import { ProductCard } from "@/components/products/ProductCard";
import { categoryLabel, normalize, searchableText } from "@/features/products/format";
import type { Category, Product } from "@/types/product";

interface ProductCatalogProps {
  readonly products: readonly Product[];
  readonly categories: readonly Category[];
}

type Filtro = Category | "todos";

/**
 * Listado del catálogo con búsqueda y filtro por categoría.
 *
 * Es la única parte de /programas que corre en el navegador, y solo porque filtrar
 * mientras se escribe tiene que ser instantáneo. El encabezado de la página sigue
 * siendo servidor.
 *
 * La búsqueda compara sin acentos y sin mayúsculas, así "diseno" encuentra "Diseño".
 */
export function ProductCatalog({ products, categories }: ProductCatalogProps) {
  const [consulta, setConsulta] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const idBusqueda = useId();

  // El texto buscable se calcula una vez por producto, no en cada tecla.
  const indice = useMemo(
    () => products.map((producto) => ({ producto, texto: searchableText(producto) })),
    [products],
  );

  const resultados = useMemo(() => {
    const termino = normalize(consulta.trim());

    return indice
      .filter(({ producto }) => filtro === "todos" || producto.category === filtro)
      .filter(({ texto }) => termino === "" || texto.includes(termino))
      .map(({ producto }) => producto);
  }, [indice, consulta, filtro]);

  const filtros: readonly Filtro[] = ["todos", ...categories];

  return (
    <div>
      <div className="flex flex-col gap-6 border-b border-border pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="w-full lg:max-w-sm">
          <label htmlFor={idBusqueda} className="eyebrow">
            Buscar
          </label>
          <input
            id={idBusqueda}
            type="search"
            value={consulta}
            onChange={(evento) => setConsulta(evento.target.value)}
            placeholder="Nombre, función o categoría"
            className="mt-2 w-full border border-border bg-background px-4 py-3 text-base text-foreground placeholder:text-muted/70 focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <p className="eyebrow" id="titulo-filtros">
            Categoría
          </p>
          <div
            role="group"
            aria-labelledby="titulo-filtros"
            className="mt-2 flex flex-wrap gap-2"
          >
            {filtros.map((valor) => {
              const activo = filtro === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setFiltro(valor)}
                  aria-pressed={activo}
                  className={
                    activo
                      ? "border border-accent bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
                      : "border border-border px-4 py-2 text-sm text-muted transition-colors hover:border-accent/50 hover:text-foreground"
                  }
                >
                  {valor === "todos" ? "Todos" : categoryLabel(valor)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p aria-live="polite" className="eyebrow mt-6">
        {resultados.length === 1
          ? "1 programa"
          : `${resultados.length} programas`}
      </p>

      {resultados.length > 0 ? (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {resultados.map((producto, indice) => (
            <li key={producto.id} className="relative">
              <ProductCard product={producto} index={indice} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6 border border-border bg-surface px-6 py-16 text-center">
          <p className="display text-2xl">
            No encontramos programas con esa búsqueda.
          </p>
          <p className="mt-3 text-sm text-muted">
            Probá con otra palabra, o mirá todas las categorías.
          </p>
          <button
            type="button"
            onClick={() => {
              setConsulta("");
              setFiltro("todos");
            }}
            className="mt-6 border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:border-accent/60 hover:bg-background"
          >
            Ver todos los programas
          </button>
        </div>
      )}
    </div>
  );
}
