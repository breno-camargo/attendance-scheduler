import {
  ApiUtils,
  getClientIp,
  getScopedProfessionalIds,
  parsePagination,
  requireAuthWithScope,
  requireProfessionalInScope,
} from '@/lib/api-utils';
import prisma from '@/lib/prisma';
import { checkApiRateLimit } from '@/lib/rate-limit';
import { clientSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/clients?page=1&limit=200
 * Retorna clientes com seus contratos e técnico vinculado.
 */
export async function GET(request: Request) {
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth } = result;

  const allowed = await checkApiRateLimit(getClientIp(request));
  if (!allowed)
    return ApiUtils.error('Muitas requisições. Tente novamente em alguns minutos.', null, 429);

  try {
    const { skip, take } = parsePagination(request.url);
    const profIds = await getScopedProfessionalIds(auth);
    const clients = await prisma.client.findMany({
      where: profIds ? { contracts: { some: { professionalId: { in: profIds } } } } : undefined,
      include: {
        contracts: {
          include: {
            professional: { select: { id: true, name: true, email: true, phone: true } },
            _count: { select: { appointments: true } },
          },
        },
      },
      // orderBy via localeCompare abaixo — Postgres default é case-sensitive e não trata acentos
      skip,
      take,
    });
    clients.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

    return ApiUtils.success(ApiUtils.maskPII(clients));
  } catch (error: unknown) {
    return ApiUtils.error('Falha ao listar clientes', error);
  }
}

/**
 * POST /api/clients
 * Cria um novo cliente e seu contrato inicial em uma única operação.
 */
export async function POST(request: Request) {
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth } = result;

  try {
    const body = await request.json();

    // Validação com Zod
    const validation = clientSchema.safeParse(body);

    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const data = validation.data;
    const scopeError = await requireProfessionalInScope(auth, data.professionalId);
    if (scopeError) return scopeError;

    const client = await prisma.client.create({
      data: {
        name: ApiUtils.capitalizeName(data.name),
        phone: data.phone || null,
        contracts: {
          create: {
            visitsPerMonth:
              typeof data.visitsPerMonth === 'string'
                ? parseInt(data.visitsPerMonth)
                : data.visitsPerMonth,
            frequency: data.frequency || 'MONTHLY',
            targetMonths: data.targetMonths || null,
            systemTypes: data.systemTypes || null,
            preferredDays: data.preferredDays || null,
            professionalId: data.professionalId || null,
          },
        },
      },
      include: {
        contracts: {
          include: {
            professional: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
    });

    return ApiUtils.success(client, 201);
  } catch (error: unknown) {
    return ApiUtils.error('Erro interno ao criar cliente', error);
  }
}
