import { NextResponse } from 'next/server';
import { getServerSession, type Session } from 'next-auth';

import { authOptions } from './auth';
import { capitalizeName, formatPhone, maskPII } from './formatting';

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.sessionInvalidated) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }
  return null;
}

// Variante que devolve a sessão quando autenticada. Usada em rotas que precisam
// do user.id pra rate limit ou audit por usuário. Retorna discriminated union
// seguindo o padrão do requireAuthWithScope.
export async function requireAuthSession(): Promise<
  { error: NextResponse; session: null } | { error: null; session: Session }
> {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.sessionInvalidated) {
    return {
      error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
      session: null,
    };
  }
  return { error: null, session };
}

// Deriva uma chave estável pra rate limit a partir da sessão. Prefere user.id
// (mais estável), cai pra email e, em último caso, pra IP — pra não virar
// "unknown" global que degradaria a proteção.
export function rateLimitKeyFromSession(session: Session, request: Request): string {
  const user = session.user as { id?: string; email?: string } | undefined;
  return user?.id || user?.email || getClientIp(request);
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
  { error: NextResponse } | { auth: AuthScope; session: Session }
> {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.sessionInvalidated) {
    return { error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) };
  }

  const role = (session.user?.role || '').toLowerCase();
  const contactId = session.user?.internalContactId;

  // Coordenador ou user sem vínculo (compatibilidade) = admin
  if (!contactId || role.includes('coordenador')) {
    return { auth: { scope: 'all', internalContactId: null }, session };
  }

  // Supervisor ou Líder = escopo filtrado
  if (role.includes('supervisor') || role.includes('líder') || role.includes('lider')) {
    return { auth: { scope: 'filtered', internalContactId: contactId }, session };
  }

  // Cargo vinculado mas nao reconhecido: negar por padrao.
  return { error: NextResponse.json({ error: 'Sem permissao' }, { status: 403 }) };
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

export async function requireProfessionalInScope(
  auth: AuthScope,
  professionalId: string | null | undefined,
): Promise<NextResponse | null> {
  if (auth.scope === 'all') return null;
  if (!professionalId) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const profIds = await getScopedProfessionalIds(auth);
  if (!profIds?.includes(professionalId)) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }
  return null;
}

export async function requireContractInScope(
  auth: AuthScope,
  contractId: string,
): Promise<NextResponse | null> {
  if (auth.scope === 'all') return null;

  const { default: prisma } = await import('./prisma');
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: { professionalId: true },
  });
  if (!contract) {
    return NextResponse.json({ error: 'Contrato nao encontrado' }, { status: 404 });
  }
  return requireProfessionalInScope(auth, contract.professionalId);
}

export async function requireClientInScope(
  auth: AuthScope,
  clientId: string,
): Promise<NextResponse | null> {
  if (auth.scope === 'all') return null;

  const profIds = await getScopedProfessionalIds(auth);
  if (!profIds || profIds.length === 0) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }

  const { default: prisma } = await import('./prisma');
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      contracts: { some: { professionalId: { in: profIds } } },
    },
    select: { id: true },
  });
  if (!client) {
    return NextResponse.json({ error: 'Sem permissao' }, { status: 403 });
  }
  return null;
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
