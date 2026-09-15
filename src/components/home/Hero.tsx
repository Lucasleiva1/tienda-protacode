import Image from "next/image";
import Link from "next/link";
import { ArrowIcon } from "@/components/ui/Icons";
import { siteConfig } from "@/config/site";

/**
 * Portada.
 *
 * La imagen va de borde a borde, nunca dentro de una tarjeta ni de un container.
 *
 * El encuadre está calculado sobre la composición real del archivo (1672×941):
 * la caja ocupa del 58% al 83% del ancho, la tarima llega hasta el 92% del alto,
 * y el panel translúcido de la izquierda arranca cerca del 42%. Ese 42% es el que
 * manda: el texto solo puede ir ENCIMA de la imagen cuando la pantalla es lo
 * bastante ancha como para que el bloque de texto termine antes de ese punto.
 *
 * Por eso el texto se superpone desde 896 px. Debajo de esa medida va abajo de
 * la imagen, y la imagen se achata por pasos para que en pantallas cortas el texto
 * no quede fuera de la vista:
 *
 *   hasta 640  → 3/4     vertical, se recorta el vacío de la izquierda
 *   640-767    → 16/10
 *   768-1279   → 16/7    achatada a propósito: en un monitor de 1024×768 la caja
 *                        entra entera y el titular asoma sin tener que bajar
 *   896+       → el texto queda encima, en la zona oscura izquierda
 *   1280+      → proporción exacta del archivo, sin recorte adicional
 */
export function Hero() {
  return (
    <section aria-labelledby="portada" className="relative">
      <div className="relative aspect-[3/4] w-full overflow-hidden sm:aspect-[16/10] md:aspect-[16/7] xl:aspect-[1672/941] xl:max-h-[88vh]">
        <Image
          src={siteConfig.cover.src}
          alt={siteConfig.cover.alt}
          fill
          priority
          sizes="100vw"
          className="object-cover object-[72%_center] sm:object-[70%_center] md:object-[62%_65%] xl:object-[58%_55%]"
        />
      </div>

      {/* Filo de luz al pie, en eco del aro iluminado de la tarima. */}
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
      />

      <div className="min-[56rem]:pointer-events-none min-[56rem]:absolute min-[56rem]:inset-0 min-[56rem]:flex min-[56rem]:items-center">
        <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 lg:px-10">
          <div className="max-w-xl pb-14 pt-6 sm:pb-16 sm:pt-8 min-[56rem]:pointer-events-auto min-[56rem]:max-w-md min-[56rem]:py-0">
            <p className="eyebrow">Programas de escritorio · Pago único</p>

            <h1
              id="portada"
              className="display mt-4 text-[2.15rem] sm:mt-5 sm:text-5xl min-[56rem]:text-5xl 2xl:text-6xl"
            >
              Herramientas que se compran una vez.
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-muted sm:mt-6 sm:text-lg">
              Pagás, descargás y las usás. La versión que comprás queda tuya de forma
              permanente, sin cuotas todos los meses.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3 sm:mt-8">
              <Link
                href="/programas"
                className="group inline-flex items-center gap-2 bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/85"
              >
                Ver programas
                <ArrowIcon className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>

              <Link
                href="#como-funciona"
                className="inline-flex items-center gap-2 border border-border px-6 py-3 text-sm font-medium text-foreground transition-colors hover:border-accent-contrast/60 hover:bg-surface"
              >
                Cómo funciona
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
