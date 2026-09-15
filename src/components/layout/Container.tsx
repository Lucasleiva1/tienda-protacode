import type { ReactNode } from "react";

interface ContainerProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/** Ancho máximo y márgenes laterales consistentes en todo el sitio. */
export function Container({ children, className = "" }: ContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
