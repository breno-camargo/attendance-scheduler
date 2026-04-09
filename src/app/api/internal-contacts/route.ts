import { ApiUtils, parsePagination, requireAuth, requireAuthWithScope } from '@/lib/api-utils';
import { UNIQUE_ROLES } from '@/lib/constants';
import prisma from '@/lib/prisma';
import { internalContactSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/internal-contacts?page=1&limit=200
 */
export async function GET(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { skip, take } = parsePagination(request.url);
    const contacts = await prisma.internalContact.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
    return ApiUtils.success(contacts);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao buscar equipe interna', error);
  }
}

export async function POST(request: Request) {
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  if (result.auth.scope === 'filtered') {
    return ApiUtils.error('Apenas o coordenador pode alterar a equipe interna', null, 403);
  }

  try {
    const body = await request.json();

    const validation = internalContactSchema.safeParse(body);
    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const data = validation.data;

    // transação pra não ter race condition se dois requests tentarem
    // criar o mesmo cargo único ao mesmo tempo
    const contact = await prisma.$transaction(async (tx) => {
      if (data.role && UNIQUE_ROLES.includes(data.role)) {
        const existing = await tx.internalContact.findFirst({
          where: { role: data.role },
        });
        if (existing) {
          throw new Error(`UNIQUE_ROLE:O cargo de '${data.role}' já está ocupado por ${existing.name}.`);
        }
      }

      return tx.internalContact.create({
        data: {
          name: ApiUtils.capitalizeName(data.name),
          role: data.role || null,
          phone: data.phone || null,
          email: data.email || null,
        },
      });
    });

    return ApiUtils.success(contact, 201);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : '';
    if (msg.startsWith('UNIQUE_ROLE:')) {
      return ApiUtils.error(msg.replace('UNIQUE_ROLE:', ''), null, 400);
    }
    return ApiUtils.error('Erro ao cadastrar equipe', error);
  }
}
