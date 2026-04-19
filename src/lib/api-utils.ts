import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from './auth';
import { capitalizeName, formatPhone, maskPII } from './formatting';

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
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return (forwarded ? forwarded.split(',')[0]?.trim() : null) || 'unknown';
}

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

    // Loga só erros de servidor (>=500) — validação 400/404 são esperados
    // e poluíam os logs sem agregar informação útil.
    if (details && status >= 500) {
      console.error(`[API ERROR ${status}] ${message}:`, details);
    }

    return NextResponse.json(
      {
        error: message,
        details: isProduction ? 'Consulte os logs do servidor.' : details,
      },
      { status },
    );
  },

  // Funções puras (maskPII, formatPhone, capitalizeName) movidas pra
  // ./formatting e delegadas aqui pra compatibilidade com server code.
  // Client components importam direto de @/lib/formatting pra não puxar
  // prisma/auth pro bundle.
  capitalizeName,
  maskPII,
  formatPhone,
};
