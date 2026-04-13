import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

import { audit } from './audit';
import prisma from './prisma';
import { checkLoginRateLimit } from './rate-limit';

// Auth simples com credentials porque é sistema interno — não precisa de
// OAuth/Google. Só quem tem login acessa, e por enquanto é só o admin.
// Se precisar de mais usuários, a tabela User já tá pronta.
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Usuário', type: 'text' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials, req) {
        const forwarded = req?.headers?.['x-forwarded-for'];
        const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : null) || 'unknown';
        const allowed = await checkLoginRateLimit(ip);
        if (!allowed) {
          audit({ event: 'LOGIN_RATE_LIMITED', ip });
          return null;
        }

        if (!credentials?.username || !credentials?.password) return null;

        // Aceita email completo ou só o username
        const rawUsername = credentials.username.trim().toLowerCase();
        const username = rawUsername.includes('@') ? rawUsername.split('@')[0] : rawUsername;

        const user = await prisma.user.findUnique({
          where: { username },
          include: { internalContact: true },
        });

        if (!user || !user.active) {
          audit({ event: 'LOGIN_FAILED', ip, details: `user: ${username.charAt(0)}***` });
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) {
          audit({ event: 'LOGIN_FAILED', userId: user.id, ip });
          return null;
        }

        audit({ event: 'LOGIN_SUCCESS', userId: user.id, ip });

        return {
          id: user.id,
          name: user.name,
          email: `${user.username}@compasss.com.br`,
          role: user.internalContact?.role || null,
          internalContactId: user.internalContactId || null,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.role = (user as { role?: string }).role || null;
        token.internalContactId = (user as { internalContactId?: string }).internalContactId || null;
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
        token.userId = (user as { id: string }).id;
      }
      // Quando o frontend pede pra atualizar a sessão (após trocar senha)
      if (trigger === 'update') {
        token.mustChangePassword = false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string | null }).role = token.role as string | null;
        (session.user as { internalContactId?: string | null }).internalContactId = token.internalContactId as string | null;
        (session.user as { mustChangePassword?: boolean }).mustChangePassword = token.mustChangePassword as boolean;
        (session.user as { id?: string }).id = token.userId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // turno de trabalho — expira no fim do dia
  },
  secret: process.env.NEXTAUTH_SECRET,
};
