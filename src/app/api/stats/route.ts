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

    const [clients, professionals, allContracts, scheduledContractIds] = await Promise.all([
      prisma.client.count({ where: clientFilter }),
      prisma.professional.count({ where: profFilter }),
      prisma.contract.findMany({
        where: contractFilter,
        select: {
          id: true,
          systemTypes: true,
          client: { select: { name: true } },
          professional: { select: { name: true } },
        },
      }),
      prisma.appointment
        .findMany({
          where: { ...aptFilter, contractId: { not: null } },
          distinct: ['contractId'],
          select: { contractId: true },
        })
        .then((rows) => new Set(rows.map((r) => r.contractId))),
    ]);

    const contractsDetail = allContracts.map((c) => ({
      id: c.id,
      clientName: c.client.name,
      professionalName: c.professional?.name ?? null,
      systemTypes: c.systemTypes,
      hasSchedule: scheduledContractIds.has(c.id),
    }));

    return ApiUtils.success({
      clients,
      professionals,
      totalContracts: allContracts.length,
      contractsWithSchedule: scheduledContractIds.size,
      contractsDetail,
    });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao buscar estatísticas', error);
  }
}
