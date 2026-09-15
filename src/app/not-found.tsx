import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { Section } from "@/components/layout/Section";

export const metadata = {
  title: "Página no encontrada",
};

export default function NotFound() {
  return (
    <main>
      <Section>
        <Container>
          <h1 className="text-3xl font-semibold">Página no encontrada</h1>
          <p className="mt-3 text-muted">
            La dirección que abriste no existe o el contenido se movió de lugar.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-md bg-accent px-4 py-2 font-medium text-accent-foreground"
          >
            Volver al inicio
          </Link>
        </Container>
      </Section>
    </main>
  );
}
