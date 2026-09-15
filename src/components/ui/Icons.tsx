/**
 * Íconos dibujados a mano.
 *
 * Son cuatro trazos: no justifica sumar una librería de íconos al proyecto.
 * Todos heredan el color del texto y se marcan como decorativos, porque el
 * significado siempre lo aporta el texto que los acompaña.
 */

type IconProps = {
  readonly className?: string;
};

export function CartIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M2.5 3.5h3l2.2 11h10.1l2.2-8H6.4" />
      <circle cx="9.5" cy="19" r="1.4" />
      <circle cx="17.5" cy="19" r="1.4" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 6.5h18M3 12h18M3 17.5h18" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 5l14 14M19 5L5 19" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="square"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
