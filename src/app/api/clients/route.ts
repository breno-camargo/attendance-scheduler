import { ApiUtils, parsePagination, requireAuth } from '@/lib/api-utils';
import prisma from '@/lib/prisma';
import { clientSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/clients?page=1&limit=200
 * Retorna clientes com seus contratos e técnico vinculado.
 */
export async function GET(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { skip, take } = parsePagination(request.url);
    const clients = await prisma.client.findMany({
      include: { contracts: { include: { professional: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });

    return ApiUtils.success(clients);
  } catch (error: unknown) {
    return ApiUtils.error('Falha ao listar clientes', error);
  }
}

/**
 * POST /api/clients
 * Cria um novo cliente e seu contrato inicial em uma única operação.
 */
export async function POST(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();

    // Validação com Zod
    const validation = clientSchema.safeParse(body);

    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const data = validation.data;

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
      include: { contracts: { include: { professional: true } } },
    });

    return ApiUtils.success(client, 201);
  } catch (error: unknown) {
    return ApiUtils.error('Erro interno ao criar cliente', error);
  }
}
