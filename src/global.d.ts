declare module '*.css';

// Augmenta o tipo Session do NextAuth pra incluir role e escopo
import 'next-auth';
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
    };
  }
}
