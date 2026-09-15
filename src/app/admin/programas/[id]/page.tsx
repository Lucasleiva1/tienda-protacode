import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { ProductDownloadPanel } from "@/components/admin/ProductDownloadPanel";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { requireAdminPage } from "@/features/admin/guard";
import { getProductRepository } from "@/features/products/product-repository";
import { getProductDownloadRepository } from "@/features/downloads/product-download-repository";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar programa" };

export default async function EditarProgramaPage({
  params,
}: PageProps<"/admin/programas/[id]">) {
  await requireAdminPage();

  const { id } = await params;
  const producto = await getProductRepository().findById(id);

  if (producto === null) notFound();
  const download = await getProductDownloadRepository().find(
    producto.id,
    producto.version,
  );

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-10 sm:px-6">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Programas", href: "/admin/programas" },
          { label: producto.name },
        ]}
      />
      <h1 className="display mt-6 text-4xl">{producto.name}</h1>
      <p className="eyebrow mt-2">
        creado {new Date(producto.createdAt).toLocaleDateString("es-AR")}
        <span className="px-2 text-border">·</span>
        última edición {new Date(producto.updatedAt).toLocaleString("es-AR")}
      </p>

      <ProductForm product={producto} />
      <ProductDownloadPanel
        productId={producto.id}
        version={producto.version}
        download={download}
      />
    </main>
  );
}
