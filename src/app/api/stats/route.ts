import { ApiUtils, getScopedProfessionalIds, requireAuthWithScope } from '@/lib/api-utils';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stats
 * Retorna contagens agregadas para o dashboard (com escopo por usuário).
 */
export async function GET() {
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth } = result;

  try {
    const profIds = await getScopedProfessionalIds(auth);
    const profFilter = profIds ? { id: { in: profIds } } : undefined;
    const clientFilter = profIds ? { contracts: { some: { professionalId: { in: profIds } } } } : undefined;
    const aptFilter = profIds ? { professionalId: { in: profIds }, status: 'SCHEDULED' as const } : { status: 'SCHEDULED' as const };

    const contractFilter = profIds ? { professionalId: { in: profIds } } : undefined;

    const [clients, professionals, totalContracts, contractsWithSchedule] = await Promise.all([
      prisma.client.count({ where: clientFilter }),
      prisma.professional.count({ where: profFilter }),
      prisma.contract.count({ where: contractFilter }),
      prisma.appointment
        .groupBy({
          by: ['contractId'],
          where: { ...aptFilter, contractId: { not: null } },
        })
        .then((groups) => groups.length),
    ]);

    return ApiUtils.success({ clients, professionals, totalContracts, contractsWithSchedule });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao buscar estatísticas', error);
  }
}
