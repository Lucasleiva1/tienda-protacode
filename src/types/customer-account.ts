export interface CustomerAccount {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly passwordHash: string | null;
  readonly googleSubject: string | null;
  readonly emailVerified: boolean;
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
}
