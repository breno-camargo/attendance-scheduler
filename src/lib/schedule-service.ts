import { toDateKey } from './date-utils';
import { getHolidaysForYear } from './holidays';
import prisma from './prisma';
import {
  generateYearSchedule,
  type GeneratedAppointment,
  type ScheduleAlgorithmWarning,
} from './schedule-algorithm';
import type { WarningContract } from './schedule-warnings';

export interface ScheduleGenerationError {
  code: 'PROFESSIONAL_NOT_FOUND';
  message: string;
}

export interface ScheduleGenerationResult {
  appointments: GeneratedAppointment[];
  contractCount: number;
  professionalId: string;
  contractIds: string[];
  // Quantos appointments já existem no banco dentro do mesmo escopo que o
  // deleteMany do /generate usa (professionalId OR contractId in [...], date
  // do ano). Permite ao preview dizer "serão substituídos X" honestamente
  // e ao audit registrar "substituiu X, criou Y".
  existingCount: number;
  // Contratos carregados, em shape mínimo pra quem quiser computar warnings
  // (só o /preview usa). /generate ignora. Deixar a computação fora do serviço
  // evita acoplar o generate a informação só útil antes da confirmação.
  contracts: WarningContract[];
  // Warnings emitidos pelo algoritmo durante a execução (Tier B). /generate
  // também ignora; /preview concatena com warnings Tier A pra UI.
  algorithmWarnings: ScheduleAlgorithmWarning[];
}

// Carrega profissional + feriados e roda o algoritmo. Não faz I/O de escrita —
// quem precisa persistir envolve o resultado em transação (ver /api/schedule/generate).
// Preview e generate compartilham esse núcleo pra não divergir.
export async function runScheduleGeneration(
  professionalId: string,
  year: number,
): Promise<ScheduleGenerationResult | ScheduleGenerationError> {
  const professional = await prisma.professional.findUnique({
    where: { id: professionalId },
    include: {
      contracts: {
        include: { client: { select: { id: true, name: true } } },
      },
    },
  });

  if (!professional || professional.contracts.length === 0) {
    return {
      code: 'PROFESSIONAL_NOT_FOUND',
      message: 'Técnico não encontrado ou sem contratos',
    };
  }

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

  const { appointments, warnings: algorithmWarnings } = generateYearSchedule(
    professional.contracts,
    year,
    holidayKeys,
  );
  const contractIds = professional.contracts.map((c) => c.id);
  const contractCount = new Set(appointments.map((a) => a.contractId)).size;

  // Mesmo escopo do deleteMany do /generate — fora isso, existingCount mentiria.
  const existingCount = await prisma.appointment.count({
    where: {
      OR: [{ professionalId: professional.id }, { contractId: { in: contractIds } }],
      date: {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      },
    },
  });

  return {
    appointments,
    contractCount,
    professionalId: professional.id,
    contractIds,
    existingCount,
    contracts: professional.contracts,
    algorithmWarnings,
  };
}

export function isGenerationError(
  result: ScheduleGenerationResult | ScheduleGenerationError,
): result is ScheduleGenerationError {
  return 'code' in result;
}

/**
 * Renumera as VISITA_TECNICA de um contrato dentro de um ano específico em ordem
 * cronológica como "Visita NN". TESTE_SDAI fica intocado.
 *
 * O escopo é por ANO porque o PDF (`/reports/contract/[id]?year=N`) também filtra
 * por ano — numeração global por contrato faria a primeira visita de um ano
 * subsequente herdar o índice do ano anterior (ex: 2025 termina em 12 → 2026
 * começa em Visita 13, e o PDF de 2026 mostra "Visita 13" como primeira).
 *
 * Idempotente: só atualiza linhas que estão fora do número correto.
 */
export async function renumberContractVisits(contractId: string, year: number): Promise<number> {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year + 1, 0, 1));

  const visits = await prisma.appointment.findMany({
    where: {
      contractId,
      type: 'VISITA_TECNICA',
      date: { gte: yearStart, lt: yearEnd },
    },
    orderBy: { date: 'asc' },
    select: { id: true, observation: true },
  });

  const updates = visits
    .map((v, i) => ({
      id: v.id,
      obs: `Visita ${(i + 1).toString().padStart(2, '0')}`,
      old: v.observation,
    }))
    .filter((v) => v.obs !== v.old);

  if (updates.length === 0) return 0;

  await prisma.$transaction(
    updates.map((v) =>
      prisma.appointment.update({ where: { id: v.id }, data: { observation: v.obs } }),
    ),
  );
  return updates.length;
}
