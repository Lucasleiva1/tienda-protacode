import { Breadcrumb } from "@/components/ui/Breadcrumb";

export function AccountShell({
  eyebrow,
  title,
  children,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  return (
    <main>
      <div className="mx-auto w-full max-w-[620px] px-4 py-14 sm:px-6 lg:py-20">
        <Breadcrumb items={[{ label: "Inicio", href: "/" }, { label: eyebrow }]} />
        <div className="mt-9 border border-border bg-surface p-6 sm:p-9">
          <p className="eyebrow text-accent-contrast">{eyebrow}</p>
          <h1 className="display mt-4 text-4xl sm:text-5xl">{title}</h1>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </main>
  );
}
