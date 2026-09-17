/**
 * Producto de prueba: "App Gratis Demo".
 *
 *     npx tsx --conditions=react-server scripts/seed-demo-gratis.ts
 *
 * Crea (o deja como está, si ya existe) un programa GRATUITO con aportes activados,
 * para ver en la tienda las cuatro combinaciones de gratis/pago y con/sin aportes.
 *
 * El QR es un DIBUJO DE PRUEBA, no un QR que se pueda escanear: sirve para ver el
 * espacio y el diseño. Se reemplaza desde el Admin por el QR real.
 */

import { deflateSync } from "node:zlib";
import { saveProductImage } from "../src/features/admin/media";
import { getProductRepository } from "../src/features/products/product-repository";
import { createProduct } from "../src/features/products/product-service";

const SLUG = "app-gratis-demo";

/* ---------------------------- PNG de prueba ---------------------------- */

function crc32(bytes: Buffer): number {
  let c = ~0;
  for (const byte of bytes) {
    c ^= byte;
    for (let i = 0; i < 8; i += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const cuerpo = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([length, cuerpo, crc]);
}

/** PNG en escala de grises, 8 bits, a partir de una grilla de módulos. */
function pngDesdeModulos(modulos: readonly (readonly boolean[])[], escala: number): Buffer {
  const lado = modulos.length * escala;
  const filas: Buffer[] = [];

  for (let y = 0; y < lado; y += 1) {
    const fila = Buffer.alloc(lado + 1); // el primer byte es el filtro (0 = ninguno)
    for (let x = 0; x < lado; x += 1) {
      const negro = modulos[Math.floor(y / escala)]![Math.floor(x / escala)]!;
      fila[x + 1] = negro ? 0x00 : 0xff;
    }
    filas.push(fila);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(lado, 0);
  ihdr.writeUInt32BE(lado, 4);
  ihdr[8] = 8; // bits por muestra
  ihdr[9] = 0; // escala de grises

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(filas))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Dibujo con forma de QR: tres ojos en las esquinas y un patrón estable. */
function qrDePrueba(): Buffer {
  const lado = 29;
  const borde = 2;
  const modulos: boolean[][] = Array.from({ length: lado }, () =>
    Array.from({ length: lado }, () => false),
  );

  function ojo(fila: number, columna: number) {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const marco = y === 0 || y === 6 || x === 0 || x === 6;
        const centro = y >= 2 && y <= 4 && x >= 2 && x <= 4;
        modulos[fila + y]![columna + x] = marco || centro;
      }
    }
  }

  for (let y = borde; y < lado - borde; y += 1) {
    for (let x = borde; x < lado - borde; x += 1) {
      // Patrón determinista: siempre sale igual, no depende del azar.
      modulos[y]![x] = ((x * 7 + y * 13 + ((x * y) % 5)) % 3) === 0;
    }
  }

  ojo(borde, borde);
  ojo(borde, lado - borde - 7);
  ojo(lado - borde - 7, borde);

  // Marco blanco alrededor, como cualquier QR.
  for (let i = 0; i < lado; i += 1) {
    for (let j = 0; j < lado; j += 1) {
      if (i < borde || j < borde || i >= lado - borde || j >= lado - borde) {
        modulos[i]![j] = false;
      }
    }
  }

  return pngDesdeModulos(modulos, 8);
}

async function main(): Promise<void> {
  const repositorio = getProductRepository();
  const existente = await repositorio.findBySlug(SLUG);

  if (existente !== null) {
    console.log(`Ya existe "${existente.name}" (${existente.id}). No se toca nada.`);
    return;
  }

  const bytes = qrDePrueba();
  const subida = await saveProductImage(
    "demo-gratis",
    new File([new Uint8Array(bytes)], "qr-demo.png", { type: "image/png" }),
  );
  if (!subida.ok) throw new Error(`No se pudo guardar el QR: ${subida.message}`);

  const resultado = await createProduct({
    name: "App Gratis Demo",
    slug: SLUG,
    appId: SLUG,
    shortDescription: "Programa de prueba para ver cómo queda una descarga gratuita.",
    description:
      "App Gratis Demo es un producto de prueba. Sirve para revisar cómo se ve un programa gratuito en la tienda: en lugar del precio aparece GRATIS, el botón principal descarga el archivo sin pasar por el carrito ni por el pago, y más abajo se muestra la sección de aporte voluntario con el alias y el QR. No hace nada al instalarlo: es solo una prueba de la ficha.",
    priceArs: 0,
    priceUsd: 0,
    currency: "ARS",
    platforms: ["windows"],
    version: "1.0.0",
    category: "utilidades",
    licenseType: "perpetual",
    downloadType: "installer",
    heroImage: null,
    images: [],
    features: [
      { name: "Descarga directa", description: "Se baja desde la ficha, sin comprar." },
      { name: "Aporte voluntario", description: "Con alias y QR, para apoyar el proyecto." },
    ],
    useCases: ["Prueba"],
    systemRequirements: [{ label: "Sistema operativo", value: "Windows 10 o superior" }],
    licenseNote: "Producto de prueba. No es una aplicación real.",
    pricingType: "free",
    licenseRequired: false,
    acceptDonations: true,
    donationAlias: "protacode.demo",
    donationQr: { src: subida.url, alt: "Código QR para aportar a App Gratis Demo" },
    donationAliasFont: "mono",
    published: true,
    featured: false,
    sortOrder: 200,
  });

  if (!resultado.ok) {
    throw new Error(`No se pudo crear: ${JSON.stringify(resultado.errors)}`);
  }

  console.log(`Creado: ${resultado.product.name}`);
  console.log(`  id:    ${resultado.product.id}`);
  console.log(`  ficha: /programas/${resultado.product.slug}`);
  console.log(`  qr:    ${subida.url}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
