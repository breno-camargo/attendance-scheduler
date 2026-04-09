import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from './auth';

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  return null;
}

export type AuthScope =
  | { scope: 'all'; internalContactId: null }
  | { scope: 'filtered'; internalContactId: string };

/**
 * Retorna o escopo do usuário logado.
 * Coordenador (ou user sem vínculo) = vê tudo.
 * Supervisor/Líder = vê só profissionais do seu escopo.
 */
export async function requireAuthWithScope(): Promise<
  { error: NextResponse } | { auth: AuthScope }
> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) };
  }

  const role = (session.user?.role || '').toLowerCase();
  const contactId = session.user?.internalContactId;

  // Coordenador ou user sem vínculo (compatibilidade) = admin
  if (!contactId || role.includes('coordenador')) {
    return { auth: { scope: 'all', internalContactId: null } };
  }

  // Supervisor ou Líder = escopo filtrado
  if (role.includes('supervisor') || role.includes('líder') || role.includes('lider')) {
    return { auth: { scope: 'filtered', internalContactId: contactId } };
  }

  // Qualquer outro papel = admin por segurança (evita bloquear acidentalmente)
  return { auth: { scope: 'all', internalContactId: null } };
}

/** Retorna IDs dos profissionais no escopo, ou undefined pra "todos". */
export async function getScopedProfessionalIds(auth: AuthScope): Promise<string[] | undefined> {
  if (auth.scope === 'all') return undefined;

  const { default: prisma } = await import('./prisma');
  const profs = await prisma.professional.findMany({
    where: { supervisorId: auth.internalContactId },
    select: { id: true },
  });
  return profs.map((p) => p.id);
}

// limit=200 porque o frontend carrega todos os clientes de uma vez pra montar
// a tabela com filtro local. Paginação server-side seria melhor mas não vale
// o esforço agora — são ~50 clientes no máximo.
export function parsePagination(url: string): { skip: number; take: number } {
  const { searchParams } = new URL(url);
  const rawPage = parseInt(searchParams.get('page') || '1');
  const rawLimit = parseInt(searchParams.get('limit') || '200');
  const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.min(200, Math.max(1, isNaN(rawLimit) ? 200 : rawLimit));
  return { skip: (page - 1) * limit, take: limit };
}

export const ApiUtils = {
  success: (data: unknown, status = 200) => {
    return NextResponse.json(data, { status });
  },

  error: (message: string, details: unknown = null, status = 500) => {
    const isProduction = process.env.NODE_ENV === 'production';

    if (details) {
      console.error(`[API ERROR] ${message}:`, details);
    }

    return NextResponse.json(
      {
        error: message,
        details: isProduction ? 'Consulte os logs do servidor.' : details,
      },
      { status },
    );
  },

  // TODO: falta tratar "ao", "em", "com" — por enquanto só pega as mais comuns
  capitalizeName: (name: string): string => {
    if (!name) return '';
    const lower = name.toLowerCase().trim();
    const prepositions = ['de', 'do', 'da', 'dos', 'das', 'e'];

    return lower
      .split(' ')
      .map((word, index) => {
        if (index > 0 && prepositions.includes(word)) return word;
        return word.charAt(0).toUpperCase() + word.slice(1);
      })
      .join(' ');
  },

  // mascara PII nas telas de listagem — o pessoal da recepção do prédio
  // não precisa ver telefone/email completo do técnico, só o suficiente
  // pra confirmar que é a pessoa certa. Na tela de detalhe mostra tudo.
  maskPII: <T>(data: T): T => {
    const applyMask = (val: string): string => {
      if (!val || typeof val !== 'string') return val;
      if (val.includes('@')) {
        const [user, domain] = val.split('@');
        return `${user.charAt(0)}****@${domain}`;
      }
      // telefone: (11) 9****-1234
      const digits = val.replace(/\D/g, '');
      if (digits.length >= 10) {
        const ddd = digits.substring(0, 2);
        const last4 = digits.substring(digits.length - 4);
        return `(${ddd}) 9****-${last4}`;
      }
      return val;
    };

    if (!data) return data;

    // Caso 1: String Pura (Uso na Interface)
    if (typeof data === 'string') return applyMask(data) as T;

    // Caso 2: Array de Objetos (Uso na API)
    if (Array.isArray(data)) {
      return data.map((item) => ApiUtils.maskPII(item)) as T;
    }

    // Caso 3: Objeto (Uso na API)
    if (typeof data === 'object') {
      const masked = { ...data } as Record<string, unknown>;
      if (masked.phone) masked.phone = applyMask(masked.phone as string);
      if (masked.email) masked.email = applyMask(masked.email as string);
      return masked as T;
    }

    return data;
  },

  formatPhone: (value: string): string => {
    if (!value) return '';
    let v = value.replace(/[^\d*]/g, '');
    if (v.length > 11) v = v.substring(0, 11);
    if (v.length <= 2) return v.length > 0 ? `(${v}` : v;
    if (v.length <= 7) return `(${v.substring(0, 2)}) ${v.substring(2)}`;
    return `(${v.substring(0, 2)}) ${v.substring(2, 7)}-${v.substring(7)}`;
  },
};
