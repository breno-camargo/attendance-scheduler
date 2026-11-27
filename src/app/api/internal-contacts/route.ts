import {
  ApiUtils,
  getClientIp,
  parsePagination,
  requireAuth,
  requireAuthWithScope,
} from '@/lib/api-utils';
import { migrateRole, UNIQUE_ROLES } from '@/lib/constants';
import prisma from '@/lib/prisma';
import { checkApiRateLimit } from '@/lib/rate-limit';
import { internalContactSchema } from '@/lib/schemas';
import { TeamHierarchyError, validateTeamSupervisor } from '@/lib/team-hierarchy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/internal-contacts?page=1&limit=200
 */
export async function GET(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  const allowed = await checkApiRateLimit(getClientIp(request));
  if (!allowed)
    return ApiUtils.error('Muitas requisições. Tente novamente em alguns minutos.', null, 429);

  try {
    const { skip, take } = parsePagination(request.url);
    const contacts = await prisma.internalContact.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
    return ApiUtils.success(ApiUtils.maskPII(contacts));
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
    const role = migrateRole(data.role || '');
    const supervisorId = data.supervisorId || null;

    // transação pra não ter race condition se dois requests tentarem
    // criar o mesmo cargo único ao mesmo tempo
    const contact = await prisma.$transaction(
      async (tx) => {
        await validateTeamSupervisor(tx, role, supervisorId);
        if (UNIQUE_ROLES.includes(role)) {
          const existing = await tx.internalContact.findFirst({
            where: { role },
          });
          if (existing) {
            throw new Error(
              `UNIQUE_ROLE:O cargo de '${data.role}' já está ocupado por ${existing.name}.`,
            );
          }
        }

        return tx.internalContact.create({
          data: {
            name: ApiUtils.capitalizeName(data.name),
            role: role || null,
            supervisorId,
            phone: data.phone || null,
            email: data.email || null,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );

    return ApiUtils.success(contact, 201);
  } catch (error: unknown) {
    if (error instanceof TeamHierarchyError) return ApiUtils.error(error.message, null, 400);
    const msg = error instanceof Error ? error.message : '';
    if (msg.startsWith('UNIQUE_ROLE:')) {
      return ApiUtils.error(msg.replace('UNIQUE_ROLE:', ''), null, 400);
    }
    return ApiUtils.error('Erro ao cadastrar equipe', error);
  }
}
