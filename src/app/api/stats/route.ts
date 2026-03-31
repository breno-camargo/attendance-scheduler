import { ApiUtils, requireAuth } from '@/lib/api-utils';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stats
 * Retorna contagens agregadas para o dashboard (evita carregar todas as entidades).
 */
export async function GET() {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const [clients, professionals, generatedSchedules] = await Promise.all([
      prisma.client.count(),
      prisma.professional.count(),
      prisma.appointment
        .groupBy({
          by: ['professionalId'],
          where: { status: 'SCHEDULED' },
        })
        .then((groups) => groups.length),
    ]);

    return ApiUtils.success({ clients, professionals, generatedSchedules });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao buscar estatísticas', error);
  }
}
