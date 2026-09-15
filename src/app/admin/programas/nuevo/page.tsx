import { ProductForm } from "@/components/admin/ProductForm";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { requireAdminPage } from "@/features/admin/guard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Nuevo programa" };

export default async function NuevoProgramaPage() {
  await requireAdminPage();

  return (
    <main className="mx-auto w-full max-w-[1500px] px-4 py-10 sm:px-6">
      <Breadcrumb
        items={[
          { label: "Admin", href: "/admin" },
          { label: "Programas", href: "/admin/programas" },
          { label: "Nuevo" },
        ]}
      />
      <h1 className="display mt-6 text-4xl">Nuevo programa</h1>
      <p className="mt-2 text-sm text-muted">
        Se guarda oculto salvo que marques “Publicado”.
      </p>

      <ProductForm product={null} />
    </main>
  );
}
