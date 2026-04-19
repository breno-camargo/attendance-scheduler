import { ApiUtils, requireAuth } from '@/lib/api-utils';
import { audit } from '@/lib/audit';
import { toDateKey } from '@/lib/date-utils';
import { getHolidaysForYear } from '@/lib/holidays';
import prisma from '@/lib/prisma';
import { generateYearSchedule } from '@/lib/schedule-algorithm';
import { generateScheduleSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

// Esse arquivo é o core do sistema. Antes a agenda era feita na mão em planilha
// e levava dias pra encaixar 40+ contratos sem conflito. O algoritmo aqui
// faz em segundos o que levava uma semana: distribui visitas e testes SDAI
// respeitando feriados, fins de semana, frequência de cada contrato e
// preferência de dia do cliente.

/**
 * POST /api/schedule/generate
 * Gera a agenda anual completa para um técnico (Operação Atômica).
 */
export async function POST(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();
    const validation = generateScheduleSchema.safeParse(body);
    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const { professionalId, year } = validation.data;

    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
      include: {
        contracts: {
          include: { client: { select: { id: true, name: true } } },
        },
      },
    });

    if (!professional || professional.contracts.length === 0) {
      return ApiUtils.error('Técnico não encontrado ou sem contratos', null, 404);
    }

    // Feriados fixos (calculados) + customizados (do banco)
    const fixedHolidays = getHolidaysForYear(year);
    const customHolidays = await prisma.holiday.findMany({
      where: {
        fixed: false,
        date: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lt: new Date(Date.UTC(year + 1, 0, 1)),
        },
      },
    });
    const holidayKeys = new Set([
      ...fixedHolidays.map((h) => h.date),
      ...customHolidays.map((h) => toDateKey(new Date(h.date))),
    ]);

    const generated = generateYearSchedule(professional.contracts, year, holidayKeys);
    const appointmentsToCreate = generated.map((a) => ({
      ...a,
      professionalId: professional.id,
    }));

    // ── OPERAÇÃO ATÔMICA ──
    // Aprendemos da pior forma: uma vez a geração falhou no meio e ficou metade
    // da agenda antiga com metade da nova. Transação resolve isso — ou gera tudo
    // ou não muda nada.
    const contractIds = professional.contracts.map((c) => c.id);

    const result = await prisma.$transaction(async (tx) => {
      // Apaga TODA a agenda do profissional (todos os anos) — quando o usuário gera
      // um novo ano, a agenda anterior é substituída conforme confirmação do frontend.
      await tx.appointment.deleteMany({
        where: {
          OR: [{ professionalId: professional.id }, { contractId: { in: contractIds } }],
        },
      });

      // createMany em vez de loop — a primeira versão criava um por um e
      // demorava ~8s pra 400 agendamentos. Com batch caiu pra <1s
      await tx.appointment.createMany({ data: appointmentsToCreate });
      return appointmentsToCreate;
    });

    const contractCount = new Set(result.map((a) => a.contractId)).size;

    audit({
      event: 'SCHEDULE_GENERATED',
      details: `${contractCount} contratos, ${result.length} atendimentos`,
    });

    return ApiUtils.success(
      {
        message: `${contractCount} agendas criadas: ${result.length} atendimentos agendados`,
        count: result.length,
        contractCount,
      },
      201,
    );
  } catch (error: unknown) {
    return ApiUtils.error('Erro estrutural ao gerar agenda', error);
  }
}

export async function GET(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get('professionalId');
    const yearParam = searchParams.get('year');
    if (!professionalId) return ApiUtils.success([]);

    // Sem ?year → retorna apenas o ano distinto que tem agendamentos (para detecção no frontend)
    if (!yearParam) {
      const first = await prisma.appointment.findFirst({
        where: { professionalId },
        orderBy: { date: 'asc' },
        select: { date: true },
      });
      const existingYear = first ? new Date(first.date).getUTCFullYear() : null;
      return ApiUtils.success({ existingYear });
    }

    const year = yearParam ? parseInt(yearParam) : new Date().getFullYear();
    if (isNaN(year) || year < 2020 || year > 2100) {
      return ApiUtils.error('Ano inválido', null, 400);
    }
    const appointments = await prisma.appointment.findMany({
      where: {
        professionalId,
        date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { date: 'asc' },
    });

    return ApiUtils.success(appointments);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao listar agendamentos', error);
  }
}

export async function DELETE(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get('professionalId');
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    if (!professionalId) return ApiUtils.error('professionalId obrigatório', null, 400);
    if (isNaN(year) || year < 2020 || year > 2100) {
      return ApiUtils.error('Ano inválido', null, 400);
    }

    const deleted = await prisma.appointment.deleteMany({
      where: {
        professionalId,
        date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
    });

    return ApiUtils.success({ message: `Agenda limpa (${deleted.count} removidos)` });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao limpar agenda', error);
  }
}
