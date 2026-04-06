import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

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
        const ip = req?.headers?.['x-forwarded-for'] || 'unknown';
        const allowed = await checkLoginRateLimit(ip);
        if (!allowed) return null;

        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });

        if (!user || !user.active) return null;

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: `${user.username}@compasss.com.br` };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // turno de trabalho — expira no fim do dia
  },
  secret: process.env.NEXTAUTH_SECRET,
};
