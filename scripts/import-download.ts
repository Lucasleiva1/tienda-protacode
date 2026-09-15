import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { getProductRepository } from "../src/features/products/product-repository";
import {
  contentTypeForFile,
  saveProductDownload,
} from "../src/features/downloads/product-download-service";
import { importLocalDownload } from "../src/lib/downloads/download-storage";

function argument(name: string): string | null {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? null : process.argv[index + 1] ?? null;
}

async function sha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

async function main(): Promise<void> {
  const productId = argument("producto");
  const inputPath = argument("archivo");
  if (productId === null || inputPath === null) {
    throw new Error(
      "Uso: npm run descarga:importar -- --producto <uuid> --archivo <ruta>",
    );
  }

  const product = await getProductRepository().findById(productId);
  if (product === null) throw new Error("No existe ese producto.");

  const absolutePath = path.resolve(inputPath);
  const fileName = path.basename(absolutePath);
  const contentType = contentTypeForFile(fileName);
  if (contentType === null) throw new Error("Formato no admitido.");
  const extension = path.extname(fileName);
  if (!fileName.toLowerCase().includes(`-v${product.version.toLowerCase()}${extension.toLowerCase()}`)) {
    throw new Error(`El archivo debe llamarse nombre-v${product.version}${extension}.`);
  }

  const fileStat = await stat(absolutePath);
  if (!fileStat.isFile() || fileStat.size <= 0) throw new Error("El archivo está vacío.");
  const storageKey = `products/${product.id}/${product.version}/${randomUUID()}-${fileName}`;
  const digest = await sha256(absolutePath);

  await importLocalDownload(storageKey, absolutePath);
  const result = await saveProductDownload(product.id, product.version, {
    storageKey,
    fileName,
    contentType,
    size: fileStat.size,
    sha256: digest,
    uploadedAt: new Date().toISOString(),
  });
  if (!result.ok) throw new Error(result.message);

  process.stdout.write(
    `Archivo privado asociado\nProducto: ${product.name}\nVersión: ${product.version}\nNombre: ${fileName}\nTamaño: ${fileStat.size} bytes\nSHA-256: ${digest}\n`,
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "Error inesperado"}\n`);
  process.exitCode = 1;
});
