/**
 * Cuenta de cliente.
 *
 * El `id` es interno (UUID) y nunca es el email. Google se vincula por `sub`
 * (`googleSubject`), que es su identificador estable. Una misma cuenta puede entrar
 * con Google, con contraseña o con ambos.
 */
export interface CustomerAccount {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly passwordHash: string | null;
  readonly googleSubject: string | null;
  readonly emailVerified: boolean;
  /** Foto pública de Google. Opcional. */
  readonly avatarUrl: string | null;
  /**
   * Versión de sesión. Cerrar sesión la incrementa y así invalida en el servidor
   * todas las cookies emitidas antes.
   */
  readonly sessionVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Único subconjunto de la cuenta que puede pasar a componentes del navegador. */
export interface CustomerProfile {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly emailVerified: boolean;
  readonly hasPassword: boolean;
  readonly hasGoogle: boolean;
  readonly avatarUrl: string | null;
}
