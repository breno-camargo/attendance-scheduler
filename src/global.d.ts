import 'next-auth';
import 'next-auth/jwt';

declare module '*.css';

// Augmenta o tipo Session do NextAuth pra incluir role e escopo
declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role?: string | null;
      internalContactId?: string | null;
      mustChangePassword?: boolean;
      sessionInvalidated?: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId?: string;
    role?: string | null;
    internalContactId?: string | null;
    mustChangePassword?: boolean;
    sessionStartedAt?: number;
    passwordChangedAt?: number;
    sessionInvalidated?: boolean;
  }
}
