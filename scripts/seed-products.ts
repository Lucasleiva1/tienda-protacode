/**
 * Importación inicial de programas al almacenamiento.
 *
 * SE EJECUTA A MANO, UNA SOLA VEZ:
 *
 *     npm run seed:productos
 *
 * NO corre solo en cada publicación: eso pisaría lo que hayas cargado desde el Admin.
 *
 * Lo que hace es copiar los programas de `src/data/products.ts` al almacén, y
 * SOLAMENTE los que todavía no estén. Si un programa ya existe (mismo slug o mismo
 * App ID) lo saltea sin tocarlo. Podés correrlo dos veces sin duplicar nada.
 *
 * A partir de acá, `products.ts` deja de ser la fuente de verdad: pasa a ser el
 * punto de partida. Los programas se administran desde /admin.
 */

import { DEV_PRODUCTS } from "../src/data/products";
import { getProductRepository } from "../src/features/products/product-repository";

async function main() {
  const repositorio = getProductRepository();
  const existentes = await repositorio.findAll();

  const slugs = new Set(existentes.map((p) => p.slug));
  const appIds = new Set(existentes.map((p) => p.appId));

  console.log(`Ya hay ${existentes.length} programa(s) en el almacén.`);

  let importados = 0;
  let salteados = 0;

  for (const producto of DEV_PRODUCTS) {
    if (slugs.has(producto.slug) || appIds.has(producto.appId)) {
      console.log(`  · ya existe, se saltea: ${producto.name}`);
      salteados += 1;
      continue;
    }

    // Id propio del almacén: el "dev-001" era del archivo de desarrollo.
    await repositorio.save({ ...producto, id: crypto.randomUUID() });
    console.log(`  + importado: ${producto.name}`);
    slugs.add(producto.slug);
    appIds.add(producto.appId);
    importados += 1;
  }

  const total = await repositorio.findAll();
  console.log("");
  console.log(`Importados: ${importados}   Salteados: ${salteados}`);
  console.log(`Total en el almacén: ${total.length}`);
}

void main();
