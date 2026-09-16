import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";
import { getLocale } from "@/i18n/server";
import { pick } from "@/i18n/shared";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: pick(locale, "Página no encontrada", "Page not found", "Página não encontrada") };
}

export default async function NotFound() {
  const locale = await getLocale();
  return (
    <main>
      <Section>
        <Container>
          <h1 className="text-3xl font-semibold">
            {pick(locale, "Página no encontrada", "Page not found", "Página não encontrada")}
          </h1>
          <p className="mt-3 text-muted">
            {pick(
              locale,
              "La dirección que abriste no existe o el contenido se movió de lugar.",
              "The address you opened does not exist or the content has moved.",
              "O endereço que você abriu não existe ou o conteúdo mudou de lugar.",
            )}
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground"
          >
            {pick(locale, "Volver al inicio", "Back to home", "Voltar ao início")}
          </Link>
        </Container>
      </Section>
    </main>
  );
}
