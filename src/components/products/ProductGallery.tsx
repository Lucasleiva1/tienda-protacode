"use client";

import Image from "next/image";
import { useState } from "react";
import type { ProductImage } from "@/types/product";

interface ProductGalleryProps {
  readonly images: readonly ProductImage[];
  readonly productName: string;
}

/**
 * Galería de capturas.
 *
 * Sin librería: una imagen grande y una fila de miniaturas que son botones reales,
 * así el teclado y el lector de pantalla funcionan sin agregar nada.
 *
 * Con una sola imagen no dibuja miniaturas, y sin imágenes no dibuja nada: no existe
 * el caso de una galería vacía con recuadros de relleno.
 */
export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activa, setActiva] = useState(0);

  if (images.length === 0) {
    return null;
  }

  const principal = images[activa] ?? images[0];

  if (principal === undefined) {
    return null;
  }

  return (
    <div>
      <Image
        src={principal.src}
        alt={principal.alt}
        width={1280}
        height={800}
        sizes="(min-width: 1024px) 60vw, 100vw"
        priority={false}
        className="aspect-[8/5] w-full border border-border object-cover"
      />

      {images.length > 1 ? (
        <ul
          className="mt-3 flex flex-wrap gap-3"
          aria-label={`Capturas de ${productName}`}
        >
          {images.map((imagen, indice) => {
            const seleccionada = indice === activa;
            return (
              <li key={imagen.src}>
                <button
                  type="button"
                  onClick={() => setActiva(indice)}
                  aria-current={seleccionada}
                  className={
                    seleccionada
                      ? "block border-2 border-accent"
                      : "block border-2 border-transparent opacity-70 transition hover:opacity-100"
                  }
                >
                  <Image
                    src={imagen.src}
                    alt=""
                    width={160}
                    height={100}
                    sizes="96px"
                    loading="lazy"
                    className="h-16 w-24 object-cover"
                  />
                  <span className="sr-only">
                    Ver captura {indice + 1} de {images.length}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
