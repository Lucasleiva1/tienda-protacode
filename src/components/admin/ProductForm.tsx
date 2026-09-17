"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { subirImagenAction } from "@/features/admin/media-actions";
import { saveProductAction } from "@/features/admin/product-actions";
import type { ProductErrors, ProductInput } from "@/features/products/product-service";
import { CATEGORIES, CURRENCIES, PLATFORMS } from "@/types/product";
import { DONATION_FONTS } from "@/config/donation-fonts";
import type { Category, Currency, Platform, Product } from "@/types/product";

interface ProductFormProps {
  /** `null` para crear. Con producto, edita. */
  readonly product: Product | null;
}

const CATEGORIA_LABEL: Record<Category, string> = {
  productividad: "Productividad",
  diseno: "Diseño",
  organizacion: "Organización",
  comercio: "Comercio",
  utilidades: "Utilidades",
};

const PLATAFORMA_LABEL: Record<Platform, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
};

/** Pasa "24900,50" o "24900.50" a centavos enteros. */
function aCentavos(texto: string): number {
  const limpio = texto.replace(/\./g, "").replace(",", ".").trim();
  const numero = Number(limpio);
  if (!Number.isFinite(numero)) return Number.NaN;
  return Math.round(numero * 100);
}

/** Y al revés, para mostrarlo en el campo. */
function aTexto(centavos: number): string {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

function vacio(product: Product | null): ProductInput {
  return {
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    appId: product?.appId ?? "",
    shortDescription: product?.shortDescription ?? "",
    description: product?.description ?? "",
    priceArs: product?.price.ARS.amount ?? 0,
    priceUsd: product?.price.USD.amount ?? 0,
    currency: product?.currency ?? "ARS",
    platforms: product?.platforms ?? ["windows"],
    version: product?.version ?? "1.0.0",
    category: product?.category ?? "utilidades",
    licenseType: "perpetual",
    downloadType: product?.downloadType ?? "installer",
    heroImage: product?.heroImage ?? null,
    images: product?.images ?? [],
    features: product?.features ?? [],
    useCases: product?.useCases ?? [],
    systemRequirements: product?.systemRequirements ?? [],
    licenseNote: product?.licenseNote ?? null,
    pricingType: product?.pricingType ?? "paid",
    licenseRequired: product?.licenseRequired ?? true,
    acceptDonations: product?.acceptDonations ?? false,
    donationAlias: product?.donationAlias ?? null,
    donationQr: product?.donationQr ?? null,
    donationAliasFont: product?.donationAliasFont ?? null,
    published: product?.published ?? false,
    featured: product?.featured ?? false,
    sortOrder: product?.sortOrder ?? 100,
  };
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const enviandoRef = useRef(false);

  const [datos, setDatos] = useState<ProductInput>(() => vacio(product));
  const [precioArs, setPrecioArs] = useState(() =>
    aTexto(product?.price.ARS.amount ?? 0),
  );
  const [precioUsd, setPrecioUsd] = useState(() =>
    aTexto(product?.price.USD.amount ?? 0),
  );
  const [errores, setErrores] = useState<ProductErrors>({});
  const [mensaje, setMensaje] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  /* Carpeta de las imágenes. Al crear todavía no hay id, así que se usa un borrador. */
  const [carpeta] = useState(() => product?.id ?? crypto.randomUUID());

  function set<K extends keyof ProductInput>(campo: K, valor: ProductInput[K]) {
    setDatos((previo) => ({ ...previo, [campo]: valor }));
    setErrores((previo) => ({ ...previo, [campo]: undefined }));
  }

  async function subir(archivo: File, destino: "hero" | "galeria" | "qr") {
    setSubiendo(true);
    setMensaje("");
    const fd = new FormData();
    fd.append("archivo", archivo);
    const resultado = await subirImagenAction(carpeta, fd);
    setSubiendo(false);

    if (!resultado.ok) {
      setMensaje(resultado.message);
      return;
    }

    const alt =
      destino === "hero"
        ? datos.name || "Imagen del programa"
        : destino === "qr"
          ? `Código QR para aportar a ${datos.name || "el programa"}`
          : `Captura de ${datos.name || "el programa"}`;

    if (destino === "qr") {
      set("donationQr", { src: resultado.url, alt });
      return;
    }

    if (destino === "hero") {
      // La foto anterior no se borra del almacén: si se cancela sin guardar, el
      // producto publicado tiene que seguir mostrándola.
      set("heroImage", { src: resultado.url, alt });
    } else {
      set("images", [...datos.images, { src: resultado.url, alt }]);
    }
  }

  function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviandoRef.current || pendiente) return;

    const ars = aCentavos(precioArs);
    const usd = aCentavos(precioUsd);
    const entrada: ProductInput = { ...datos, priceArs: ars, priceUsd: usd };

    enviandoRef.current = true;
    setErrores({});
    setMensaje("");

    startTransition(async () => {
      const resultado = await saveProductAction(product?.id ?? null, entrada);

      if (resultado.ok) {
        router.push("/admin/programas");
        router.refresh();
        return;
      }

      enviandoRef.current = false;
      if (resultado.errors !== undefined) setErrores(resultado.errors);
      setMensaje(resultado.message ?? "Revisá los campos marcados.");
    });
  }

  const guardando = pendiente;
  const gratuito = datos.pricingType === "free";

  return (
    <form onSubmit={guardar} noValidate className="mt-8">
      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-start lg:gap-12">
        <div className="space-y-10">
          {/*
            Primer bloque a propósito: antes estaba al fondo de la columna fija de la
            derecha y quedaba cortado fuera de la pantalla. Por ahora una sola foto;
            la galería sigue en los datos pero no se edita desde acá.
          */}
          <Bloque titulo="Foto del producto">
            {datos.heroImage !== null ? (
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <Image
                  src={datos.heroImage.src}
                  alt=""
                  width={640}
                  height={400}
                  unoptimized
                  className="max-h-72 w-full border border-border bg-background object-contain"
                />
                <div className="flex flex-wrap gap-2 sm:flex-col">
                  <SubirArchivo
                    id="hero"
                    texto="Cambiar foto"
                    deshabilitado={subiendo}
                    onArchivo={(f) => void subir(f, "hero")}
                  />
                  <button
                    type="button"
                    disabled={subiendo}
                    onClick={() => set("heroImage", null)}
                    className="mt-2 border border-border px-4 py-2.5 text-xs uppercase tracking-wider text-muted hover:border-danger/60 hover:text-foreground"
                  >
                    Quitar foto
                  </button>
                </div>
              </div>
            ) : (
              <div className="border border-dashed border-border bg-background px-5 py-8 text-center">
                <p className="text-sm text-muted">Este producto todavía no tiene foto.</p>
                <SubirArchivo
                  id="hero"
                  texto="Elegir foto"
                  deshabilitado={subiendo}
                  onArchivo={(f) => void subir(f, "hero")}
                />
              </div>
            )}
            <p className="text-xs text-muted">
              JPG, PNG o WEBP. Hasta 3 MB. Es la imagen que se ve en la tienda y en el
              catálogo. Para que quede guardada, apretá “Guardar” al final.
            </p>
            {subiendo ? <p className="text-sm text-accent-contrast">Subiendo foto…</p> : null}
          </Bloque>

          <Bloque titulo="Identificación">
            <Texto
              id="name"
              label="Nombre"
              value={datos.name}
              error={errores.name}
              onChange={(v) => set("name", v)}
            />
            <Texto
              id="slug"
              label="Slug (dirección web)"
              ayuda="Se usa en /programas/loquesea. Si lo dejás vacío, sale del nombre."
              value={datos.slug}
              error={errores.slug}
              onChange={(v) => set("slug", v)}
            />
            <Texto
              id="appId"
              label="App ID"
              ayuda="Identificador interno para las licencias. No lo ve el comprador."
              value={datos.appId}
              error={errores.appId}
              onChange={(v) => set("appId", v)}
            />
          </Bloque>

          <Bloque titulo="Textos">
            <Texto
              id="shortDescription"
              label="Descripción corta"
              ayuda="Una línea. Es la que se ve en el catálogo."
              value={datos.shortDescription}
              error={errores.shortDescription}
              onChange={(v) => set("shortDescription", v)}
            />
            <Area
              id="description"
              label="Descripción completa"
              value={datos.description}
              error={errores.description}
              onChange={(v) => set("description", v)}
            />
          </Bloque>

          <Bloque titulo="Funciones">
            <Lista
              items={datos.features}
              vacio={{ name: "", description: "" }}
              onChange={(v) => set("features", v)}
              etiquetaAgregar="Agregar función"
              render={(item, actualizar, i) => (
                <>
                  <Texto
                    id={`f-nombre-${i}`}
                    label="Título"
                    value={item.name}
                    onChange={(v) => actualizar({ ...item, name: v })}
                  />
                  <Texto
                    id={`f-desc-${i}`}
                    label="Explicación"
                    value={item.description}
                    onChange={(v) => actualizar({ ...item, description: v })}
                  />
                </>
              )}
            />
          </Bloque>

          <Bloque titulo="Para qué sirve">
            <Lista
              items={datos.useCases}
              vacio=""
              onChange={(v) => set("useCases", v)}
              etiquetaAgregar="Agregar caso de uso"
              render={(item, actualizar, i) => (
                <Texto
                  id={`u-caso-${i}`}
                  label="Caso de uso"
                  value={item}
                  onChange={(v) => actualizar(v)}
                />
              )}
            />
          </Bloque>

          <Bloque titulo="Requisitos">
            <Lista
              items={datos.systemRequirements}
              vacio={{ label: "", value: "" }}
              onChange={(v) => set("systemRequirements", v)}
              etiquetaAgregar="Agregar requisito"
              render={(item, actualizar, i) => (
                <>
                  <Texto
                    id={`r-label-${i}`}
                    label="Requisito"
                    value={item.label}
                    onChange={(v) => actualizar({ ...item, label: v })}
                  />
                  <Texto
                    id={`r-valor-${i}`}
                    label="Detalle"
                    value={item.value}
                    onChange={(v) => actualizar({ ...item, value: v })}
                  />
                </>
              )}
            />
          </Bloque>
        </div>

        <div className="space-y-8">
          <Bloque titulo="Precio">
            <Selector
              id="pricingType"
              label="Tipo de producto"
              value={datos.pricingType}
              opciones={[
                { valor: "paid", texto: "Pago" },
                { valor: "free", texto: "Gratis" },
              ]}
              onChange={(v) => {
                set("pricingType", v as ProductInput["pricingType"]);
                // Valor habitual de cada tipo; se puede cambiar abajo.
                set("licenseRequired", v === "paid");
              }}
            />

            {gratuito ? (
              /* Un gratuito no muestra precio en la tienda: los campos no aplican.
                 Lo que ya estaba cargado se conserva por si vuelve a ser pago. */
              <p className="border border-border bg-background px-3 py-2.5 text-xs leading-relaxed text-muted">
                Este programa se descarga gratis desde su ficha: no pasa por el
                carrito ni por el pago, y en la tienda se muestra “GRATIS” en lugar
                del precio.
              </p>
            ) : (
              <>
                <Texto
                  id="priceArs"
                  label="Precio en pesos"
                  value={precioArs}
                  error={errores.priceArs}
                  onChange={setPrecioArs}
                />
                <Texto
                  id="priceUsd"
                  label="Precio en dólares"
                  value={precioUsd}
                  error={errores.priceUsd}
                  onChange={setPrecioUsd}
                />
                <Selector
                  id="currency"
                  label="Moneda que se muestra"
                  value={datos.currency}
                  opciones={CURRENCIES.map((c) => ({ valor: c, texto: c }))}
                  onChange={(v) => set("currency", v as Currency)}
                />
              </>
            )}

            <Casilla
              id="licenseRequired"
              label="Requiere clave de licencia"
              ayuda={
                gratuito
                  ? "Encendido: el cliente entra con su cuenta y recibe una licencia gratis. Apagado: se descarga directo, sin cuenta."
                  : "Apagado: después de confirmar el pago se entrega solo la descarga, sin clave."
              }
              checked={datos.licenseRequired}
              onChange={(v) => set("licenseRequired", v)}
            />
          </Bloque>

          <Bloque titulo="Aportes voluntarios">
            <Casilla
              id="acceptDonations"
              label="Aceptar aportes"
              ayuda="Muestra alias y QR en la ficha. No es una compra: no genera pedido ni licencia."
              checked={datos.acceptDonations}
              onChange={(v) => set("acceptDonations", v)}
            />

            {datos.acceptDonations ? (
              <>
                <Texto
                  id="donationAlias"
                  label="Alias para aportes"
                  ayuda="El alias que copia quien quiera aportar. Podés dejarlo vacío si solo usás QR."
                  value={datos.donationAlias ?? ""}
                  error={errores.donationAlias}
                  onChange={(v) => set("donationAlias", v === "" ? null : v)}
                />

                <Selector
                  id="donationAliasFont"
                  label="Tipografía del alias"
                  value={datos.donationAliasFont ?? "sitio"}
                  opciones={DONATION_FONTS.map((fuente) => ({
                    valor: fuente.key,
                    texto: fuente.label,
                  }))}
                  onChange={(v) =>
                    set("donationAliasFont", v === "sitio" ? null : v)
                  }
                />

                <div>
                  <p className="eyebrow">QR para aportes</p>
                  {datos.donationQr !== null ? (
                    <div className="mt-2">
                      <Image
                        src={datos.donationQr.src}
                        alt=""
                        width={200}
                        height={200}
                        unoptimized
                        className="h-auto w-40 border border-border bg-background p-2"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <SubirArchivo
                          id="qr"
                          texto="Cambiar QR"
                          deshabilitado={subiendo}
                          onArchivo={(f) => void subir(f, "qr")}
                        />
                        <button
                          type="button"
                          disabled={subiendo}
                          onClick={() => set("donationQr", null)}
                          className="mt-2 border border-border px-4 py-2.5 text-xs uppercase tracking-wider text-muted hover:border-danger/60 hover:text-foreground"
                        >
                          Quitar QR
                        </button>
                      </div>
                    </div>
                  ) : (
                    <SubirArchivo
                      id="qr"
                      texto="Subir QR"
                      deshabilitado={subiendo}
                      onArchivo={(f) => void subir(f, "qr")}
                    />
                  )}
                  <p className="mt-2 text-xs text-muted">
                    JPG, PNG o WEBP. Hasta 3 MB. Si no cargás QR, se muestra solo el
                    alias; si no cargás alias, se muestra solo el QR.
                  </p>
                </div>
              </>
            ) : null}
          </Bloque>

          <Bloque titulo="Ficha técnica">
            <Texto
              id="version"
              label="Versión"
              value={datos.version}
              error={errores.version}
              onChange={(v) => set("version", v)}
            />
            <Selector
              id="category"
              label="Categoría"
              value={datos.category}
              opciones={CATEGORIES.map((c) => ({
                valor: c,
                texto: CATEGORIA_LABEL[c],
              }))}
              onChange={(v) => set("category", v as Category)}
            />

            <fieldset>
              <legend className="eyebrow">Sistemas</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {PLATFORMS.map((plataforma) => (
                  <label
                    key={plataforma}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={datos.platforms.includes(plataforma)}
                      onChange={(e) =>
                        set(
                          "platforms",
                          e.target.checked
                            ? [...datos.platforms, plataforma]
                            : datos.platforms.filter((p) => p !== plataforma),
                        )
                      }
                      className="h-4 w-4 accent-[var(--accent)]"
                    />
                    {PLATAFORMA_LABEL[plataforma]}
                  </label>
                ))}
              </div>
              {errores.platforms !== undefined ? (
                <p className="mt-2 text-sm text-danger">⚠ {errores.platforms}</p>
              ) : null}
            </fieldset>

            <Selector
              id="downloadType"
              label="Entrega"
              value={datos.downloadType}
              opciones={[
                { valor: "installer", texto: "Instalador" },
                { valor: "portable", texto: "Portable" },
                { valor: "archive", texto: "Archivo comprimido" },
              ]}
              onChange={(v) =>
                set("downloadType", v as ProductInput["downloadType"])
              }
            />
          </Bloque>

          <Bloque titulo="Visibilidad">
            <Casilla
              id="published"
              label="Publicado"
              ayuda="Si está apagado, no se ve en la tienda."
              checked={datos.published}
              onChange={(v) => set("published", v)}
            />
            <Casilla
              id="featured"
              label="Destacado"
              ayuda="Además aparece en la sección de producto destacado."
              checked={datos.featured}
              onChange={(v) => set("featured", v)}
            />
            <Texto
              id="sortOrder"
              label="Orden de aparición"
              ayuda="Menor primero. Conviene numerar de a 10: 10, 20, 30."
              value={String(datos.sortOrder)}
              error={errores.sortOrder}
              onChange={(v) => set("sortOrder", Number(v) || 0)}
            />
          </Bloque>
        </div>
      </div>

      <div aria-live="polite" className="mt-10">
        {mensaje !== "" ? (
          <p className="border border-danger/50 bg-danger/10 px-4 py-3 text-sm text-foreground">
            ⚠ {mensaje}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border pt-6">
        <button
          type="submit"
          disabled={guardando || subiendo}
          className="bg-accent px-7 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-accent-foreground transition-colors hover:bg-accent-contrast disabled:cursor-wait disabled:border disabled:border-border disabled:bg-transparent disabled:text-muted"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>

        <Link
          href="/admin/programas"
          className="border border-border px-6 py-3.5 text-sm font-semibold uppercase tracking-[0.08em] text-muted transition-colors hover:text-foreground"
        >
          Cancelar
        </Link>

        {subiendo ? (
          <span className="text-sm text-muted">Subiendo imagen…</span>
        ) : null}
      </div>
    </form>
  );
}

/* ------------------------------ piezas ------------------------------ */

function Bloque({
  titulo,
  children,
}: {
  readonly titulo: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="border border-border bg-surface p-5">
      <h2 className="eyebrow text-accent-contrast">{titulo}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

interface CampoBase {
  readonly id: string;
  readonly label: string;
  readonly ayuda?: string;
  readonly error?: string | undefined;
}

function Texto({
  id,
  label,
  ayuda,
  value,
  error,
  onChange,
}: CampoBase & {
  readonly value: string;
  readonly onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error !== undefined}
        aria-describedby={error !== undefined ? `${id}-error` : undefined}
        className={`mt-1.5 w-full border bg-background px-3 py-2 text-sm text-foreground focus:outline-none ${
          error !== undefined ? "border-danger" : "border-border focus:border-accent"
        }`}
      />
      {ayuda !== undefined && error === undefined ? (
        <p className="mt-1 text-xs text-muted">{ayuda}</p>
      ) : null}
      {error !== undefined ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-danger">
          ⚠ {error}
        </p>
      ) : null}
    </div>
  );
}

function Area({
  id,
  label,
  value,
  error,
  onChange,
}: CampoBase & {
  readonly value: string;
  readonly onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <textarea
        id={id}
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error !== undefined}
        className={`mt-1.5 w-full border bg-background px-3 py-2 text-sm leading-relaxed text-foreground focus:outline-none ${
          error !== undefined ? "border-danger" : "border-border focus:border-accent"
        }`}
      />
      {error !== undefined ? (
        <p className="mt-1 text-sm text-danger">⚠ {error}</p>
      ) : null}
    </div>
  );
}

function Selector({
  id,
  label,
  value,
  opciones,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly opciones: readonly { readonly valor: string; readonly texto: string }[];
  readonly onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="eyebrow">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none"
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}

function Casilla({
  id,
  label,
  ayuda,
  checked,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly ayuda?: string;
  readonly checked: boolean;
  readonly onChange: (v: boolean) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        {label}
      </label>
      {ayuda !== undefined ? (
        <p className="ml-6.5 mt-1 text-xs text-muted">{ayuda}</p>
      ) : null}
    </div>
  );
}

function SubirArchivo({
  id,
  texto = "Elegir imagen",
  deshabilitado,
  onArchivo,
}: {
  readonly id: string;
  readonly texto?: string;
  readonly deshabilitado: boolean;
  readonly onArchivo: (archivo: File) => void;
}) {
  return (
    <div className="mt-2">
      <label
        htmlFor={`subir-${id}`}
        className="inline-block cursor-pointer border border-accent px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
      >
        {texto}
      </label>
      <input
        id={`subir-${id}`}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={deshabilitado}
        className="sr-only"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo !== undefined) onArchivo(archivo);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/**
 * Lista editable genérica.
 *
 * Sirve para funciones, casos de uso y requisitos: agregar, editar y quitar con
 * botones. El Admin nunca tiene que escribir JSON a mano.
 */
function Lista<T>({
  items,
  vacio,
  onChange,
  etiquetaAgregar,
  render,
}: {
  readonly items: readonly T[];
  readonly vacio: T;
  readonly onChange: (items: readonly T[]) => void;
  readonly etiquetaAgregar: string;
  readonly render: (
    item: T,
    actualizar: (nuevo: T) => void,
    indice: number,
  ) => React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      {items.map((item, indice) => (
        <div
          key={indice}
          className="space-y-3 border border-border/70 bg-background p-3"
        >
          {render(
            item,
            (nuevo) => {
              const copia = [...items];
              copia[indice] = nuevo;
              onChange(copia);
            },
            indice,
          )}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, i) => i !== indice))}
            className="border border-border px-2.5 py-1 text-xs uppercase tracking-wider text-muted hover:border-danger/60 hover:text-foreground"
          >
            Eliminar
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...items, vacio])}
        className="border border-border px-3 py-1.5 text-xs uppercase tracking-wider text-foreground transition-colors hover:border-accent"
      >
        + {etiquetaAgregar}
      </button>
    </div>
  );
}
