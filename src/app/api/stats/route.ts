import { ApiUtils, getScopedProfessionalIds, requireAuthWithScope } from '@/lib/api-utils';
import prisma from '@/lib/prisma';
import { annualScheduleWhere } from '@/lib/schedule-year';
import { scheduleYearSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stats
 * Retorna contagens agregadas para o dashboard (com escopo por usuário).
 */
export async function GET(request: Request) {
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth } = result;

  try {
    const year = scheduleYearSchema.safeParse(
      new URL(request.url).searchParams.get('year') ?? new Date().getFullYear(),
    );
    if (!year.success) return ApiUtils.error('Ano inválido', null, 400);

    const profIds = await getScopedProfessionalIds(auth);
    const profFilter = profIds ? { id: { in: profIds } } : undefined;
    const clientFilter = profIds
      ? { contracts: { some: { professionalId: { in: profIds } } } }
      : undefined;
    const contractFilter = profIds ? { professionalId: { in: profIds } } : undefined;

    const [clients, professionals, allContracts, scheduledContractIds] = await Promise.all([
      prisma.client.count({ where: clientFilter }),
      prisma.professional.count({ where: profFilter }),
      // Seleciona o mínimo necessário pra agregar pendingTechs no server. Nome
      // de cliente e systemTypes ficam fora do payload — antes saíam à toa só
      // pra o dashboard derivar uma lista de nomes de técnicos pendentes.
      prisma.contract.findMany({
        where: contractFilter,
        select: {
          id: true,
          professional: { select: { name: true } },
        },
      }),
      prisma.appointment
        .findMany({
          where: {
            ...annualScheduleWhere(year.data),
            contractId: { not: null },
            contract: contractFilter,
          },
          distinct: ['contractId'],
          select: { contractId: true },
        })
        .then((rows) => new Set(rows.map((r) => r.contractId))),
    ]);

    const pendingContracts = allContracts.filter(
      (contract) => !scheduledContractIds.has(contract.id),
    );
    const pendingTechs = Array.from(
      new Set(pendingContracts.map((c) => c.professional?.name ?? 'Sem técnico')),
    ).sort();

    return ApiUtils.success({
      clients,
      professionals,
      totalContracts: allContracts.length,
      contractsWithSchedule: allContracts.length - pendingContracts.length,
      pendingTechs,
    });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao buscar estatísticas', error);
  }
}
