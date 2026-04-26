import {
  ApiUtils,
  rateLimitKeyFromSession,
  requireAuthWithScope,
  requireProfessionalInScope,
} from '@/lib/api-utils';
import { audit } from '@/lib/audit';
import { writeAuditLog } from '@/lib/audit-log';
import prisma from '@/lib/prisma';
import { checkGenerateRateLimit } from '@/lib/rate-limit';
import { isGenerationError, runScheduleGeneration } from '@/lib/schedule-service';
import { computeScheduleWarnings } from '@/lib/schedule-warnings';
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
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth, session } = result;

  const rateKey = rateLimitKeyFromSession(session, request);
  const allowed = await checkGenerateRateLimit(rateKey);
  if (!allowed) {
    return ApiUtils.error(
      'Muitas gerações em pouco tempo. Aguarde antes de tentar de novo.',
      null,
      429,
    );
  }

  try {
    const body = await request.json();
    const validation = generateScheduleSchema.safeParse(body);
    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const { professionalId, year } = validation.data;
    const scopeError = await requireProfessionalInScope(auth, professionalId);
    if (scopeError) return scopeError;

    const generation = await runScheduleGeneration(professionalId, year);
    if (isGenerationError(generation)) {
      return ApiUtils.error(generation.message, null, 404);
    }

    const { appointments, contractCount, contractIds, existingCount } = generation;
    const appointmentsToCreate = appointments.map((a) => ({
      ...a,
      professionalId: generation.professionalId,
    }));

    // ── OPERAÇÃO ATÔMICA ──
    // Aprendemos da pior forma: uma vez a geração falhou no meio e ficou metade
    // da agenda antiga com metade da nova. Transação resolve isso — ou gera tudo
    // ou não muda nada.
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

    const result = await prisma.$transaction(async (tx) => {
      // Apaga a agenda do ano alvo: appointments do profissional OU de contratos
      // atuais dele (cobre reassociação recente), mas só dentro do intervalo do
      // ano — outros anos ficam preservados.
      await tx.appointment.deleteMany({
        where: {
          OR: [{ professionalId: generation.professionalId }, { contractId: { in: contractIds } }],
          date: { gte: yearStart, lt: yearEnd },
        },
      });

      // createMany em vez de loop — a primeira versão criava um por um e
      // demorava ~8s pra 400 agendamentos. Com batch caiu pra <1s
      await tx.appointment.createMany({ data: appointmentsToCreate });
      return appointmentsToCreate;
    });

    audit({
      event: 'SCHEDULE_GENERATED',
      details: `${contractCount} contratos, substituiu ${existingCount}, criou ${result.length}`,
    });

    // Log persistente de geração. Rodado DEPOIS do commit — bug aqui não
    // pode reverter a agenda. Falha do insert gera só console.error pra
    // não escalar pra resposta de erro ao cliente.
    try {
      // Mesma combinação de Tier A + Tier B que o /preview mostrou ao usuário.
      const warnings = [
        ...computeScheduleWarnings(generation.contracts),
        ...generation.algorithmWarnings,
      ];
      const userId = (session.user as { id?: string } | undefined)?.id ?? null;
      await prisma.scheduleGenerationLog.create({
        data: {
          userId,
          professionalId: generation.professionalId,
          year,
          existingCount,
          createdCount: result.length,
          contractCount,
          warningsJson: warnings.length > 0 ? JSON.stringify(warnings) : null,
        },
      });
    } catch (logError) {
      console.error('[ScheduleGenerationLog] falha ao persistir log:', logError);
    }

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
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth } = result;

  try {
    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get('professionalId');
    const yearParam = searchParams.get('year');
    if (!professionalId) return ApiUtils.success([]);
    const scopeError = await requireProfessionalInScope(auth, professionalId);
    if (scopeError) return scopeError;

    // Sem ?year → retorna os anos distintos que têm agendamentos. Precisa espelhar
    // o escopo do deleteMany do POST (professionalId OR contractId in [...]) —
    // senão o preview mente pro usuário no caso de contrato reassociado: prof B
    // herda um contrato que tinha agenda com prof A, e o generate vai apagar
    // essa agenda junto, mesmo que prof B "não tenha" appointments próprios.
    if (!yearParam) {
      const prof = await prisma.professional.findUnique({
        where: { id: professionalId },
        include: { contracts: { select: { id: true } } },
      });
      const contractIds = prof?.contracts.map((c) => c.id) ?? [];
      const whereOr: { professionalId?: string; contractId?: { in: string[] } }[] = [
        { professionalId },
      ];
      if (contractIds.length > 0) whereOr.push({ contractId: { in: contractIds } });

      const rows = await prisma.appointment.findMany({
        where: { OR: whereOr },
        select: { date: true },
      });
      const years = Array.from(new Set(rows.map((r) => new Date(r.date).getUTCFullYear()))).sort(
        (a, b) => a - b,
      );
      return ApiUtils.success({ years });
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
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth, session } = result;

  try {
    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get('professionalId');
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

    if (!professionalId) return ApiUtils.error('professionalId obrigatório', null, 400);
    if (isNaN(year) || year < 2020 || year > 2100) {
      return ApiUtils.error('Ano inválido', null, 400);
    }

    const scopeError = await requireProfessionalInScope(auth, professionalId);
    if (scopeError) return scopeError;

    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
      select: { id: true, name: true },
    });
    if (!professional) {
      return ApiUtils.error('Técnico não encontrado', null, 404);
    }

    const deleted = await prisma.appointment.deleteMany({
      where: {
        professionalId,
        date: { gte: new Date(Date.UTC(year, 0, 1)), lt: new Date(Date.UTC(year + 1, 0, 1)) },
      },
    });

    await writeAuditLog({
      session,
      action: 'SCHEDULE_CLEARED',
      entityType: 'SCHEDULE',
      entityId: professional.id,
      entityLabel: `${professional.name} — ${year}`,
      metadata: { professionalId, year, deletedCount: deleted.count },
    });

    return ApiUtils.success({ message: `Agenda limpa (${deleted.count} removidos)` });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao limpar agenda', error);
  }
}
