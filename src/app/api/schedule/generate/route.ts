import type { Contract, Client } from '@prisma/client';

import { ApiUtils, requireAuth } from '@/lib/api-utils';
import prisma from '@/lib/prisma';
import { generateScheduleSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

// Esse arquivo é o core do sistema. Antes a agenda era feita na mão em planilha
// e levava dias pra encaixar 40+ contratos sem conflito. O algoritmo aqui
// faz em segundos o que levava uma semana: distribui visitas e testes SDAI
// respeitando feriados, fins de semana, frequência de cada contrato e
// preferência de dia do cliente.

// ---
// Tipos
// ---

type ContractWithClient = Contract & { client: Client };

type AppointmentType = 'VISITA_TECNICA' | 'TESTE_SDAI';

interface SlotEntry {
  contract: ContractWithClient;
  type: AppointmentType;
  observation?: string;
}

interface AppointmentData {
  clientId: string;
  professionalId: string;
  contractId: string;
  date: Date;
  type: AppointmentType;
  observation?: string;
}

// ---
// Utilitários de Data
// ---

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

const getSaturdays = (year: number, month: number): Date[] => {
  const sats: Date[] = [];
  const totalDays = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === 6) sats.push(date);
  }
  return sats;
};

const toDateKey = (date: Date) => date.toISOString().split('T')[0];

// ---
// Constantes de Frequência
// ---

const FREQUENCY_PERIOD: Record<string, number> = {
  MONTHLY: 1,
  BIMONTHLY: 2,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

// ---
// POST — Gerar Agenda Automática
// ---

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
      include: { contracts: { include: { client: true } } },
    });

    if (!professional || professional.contracts.length === 0) {
      return ApiUtils.error('Técnico não encontrado ou sem contratos', null, 404);
    }

    // Pré-carrega TODOS os feriados do ano em memória (1 query em vez de ~250)
    const holidaysInYear = await prisma.holiday.findMany({
      where: {
        date: {
          gte: new Date(year, 0, 1),
          lt: new Date(year + 1, 0, 1),
        },
      },
    });
    const holidayKeys = new Set(holidaysInYear.map((h) => toDateKey(new Date(h.date))));
    const isHolidayFast = (date: Date) => holidayKeys.has(toDateKey(date));

    const getWorkDaysFast = (y: number, month: number): Date[] => {
      const days: Date[] = [];
      const totalDays = new Date(y, month + 1, 0).getDate();
      for (let d = 1; d <= totalDays; d++) {
        const date = new Date(y, month, d);
        if (!isWeekend(date) && !isHolidayFast(date)) days.push(date);
      }
      return days;
    };

    const contracts = professional.contracts as ContractWithClient[];
    const appointmentsToCreate: AppointmentData[] = [];
    const visitCounter: Record<string, number> = {};
    contracts.forEach((c) => (visitCounter[c.id] = 1));

    // ── ETAPA 1: Pré-alocar Testes SDAI (Trimestrais, Sábados) ──
    // SDAI é obrigatório por norma — teste trimestral do sistema de detecção
    // de incêndio. Tem que ser no sábado porque o prédio precisa estar vazio
    // (o alarme dispara de verdade). Cada contrato entra num grupo de rotação
    // pra não cair todo mundo no mesmo mês.
    const sdaiSchedule: Record<number, { contract: ContractWithClient; date: Date }[]> = {};
    const usedSdaiDates = new Set<string>();

    const sdaiContracts = contracts.filter(
      (c) => c.frequency === 'MONTHLY' && c.systemTypes?.includes('SDAI'),
    );
    for (let idx = 0; idx < sdaiContracts.length; idx++) {
      const contract = sdaiContracts[idx];
      // distribui contratos em 3 grupos pra não sobrecarregar o mesmo mês
      const rotationGroup = idx % 3;
      for (let month = rotationGroup; month < 12; month += 3) {
        const saturdays = getSaturdays(year, month);
        // prefere sábados perto do dia 25 — meu supervisor pedia pra ser
        // no final do mês porque o relatório mensal fecha dia 30
        const sortedSats = [...saturdays].sort(
          (a, b) => Math.abs(a.getDate() - 25) - Math.abs(b.getDate() - 25),
        );

        let chosenDate = sortedSats.find((s) => !usedSdaiDates.has(toDateKey(s)));
        if (!chosenDate) {
          const workDays = getWorkDaysFast(year, month);
          chosenDate = workDays.find((d) => !usedSdaiDates.has(toDateKey(d)));
        }

        if (chosenDate) {
          usedSdaiDates.add(toDateKey(chosenDate));
          if (!sdaiSchedule[month]) sdaiSchedule[month] = [];
          sdaiSchedule[month].push({ contract, date: chosenDate });
        }
      }
    }

    // ── ETAPA 2: Distribuir Visitas Técnicas por Mês ──
    // Aqui é onde a planilha virava um pesadelo. Cada contrato tem frequência
    // diferente, alguns pedem dias específicos, e não pode ter 3 visitas no
    // mesmo dia enquanto outra semana fica vazia. O algoritmo tenta espaçar
    // as visitas uniformemente e prioriza contratos com restrição de dia.
    for (let month = 0; month < 12; month++) {
      const workDays = getWorkDaysFast(year, month);
      const daySlots: (SlotEntry | null)[] = new Array(workDays.length).fill(null);
      const monthlySdai = sdaiSchedule[month] || [];

      // Mark daySlots for SDAI dates that landed on workdays.
      // SDAI dates on Saturdays won't find a matching workDay index (findIndex
      // returns -1) and therefore can't be marked here — those are tracked via
      // usedSdaiDates instead and blocked below.
      monthlySdai.forEach((s) => {
        const idx = workDays.findIndex((d) => toDateKey(d) === toDateKey(s.date));
        if (idx !== -1) daySlots[idx] = { contract: s.contract, type: 'TESTE_SDAI' };
      });

      // Build a per-month set of SDAI date keys so that findBestSlot skips any
      // workday that was used as a fallback for an SDAI appointment (step 1
      // may fall back to a workday when no Saturday is available).
      const sdaiDates = new Set<string>(monthlySdai.map((s) => toDateKey(s.date)));

      const sortedContracts = [...contracts].sort((a, b) => {
        const aPref = !!a.preferredDays;
        const bPref = !!b.preferredDays;
        if (aPref !== bPref) return aPref ? -1 : 1;
        return (a.visitsPerMonth || 0) - (b.visitsPerMonth || 0);
      });

      for (let cIdx = 0; cIdx < sortedContracts.length; cIdx++) {
        const contract = sortedContracts[cIdx];
        const isActive = checkMonthActivity(contract, month);
        if (!isActive) continue;

        const hasSdaiThisMonth = monthlySdai.some((s) => s.contract.id === contract.id);
        const visitsGoal = contract.visitsPerMonth || 1;
        const remaining = hasSdaiThisMonth
          ? visitsGoal - 1
          : contract.frequency === 'MONTHLY'
            ? visitsGoal
            : 1;

        if (remaining <= 0) continue;

        const prefDays = contract.preferredDays?.split(',').map(Number) || [];
        const usedIndices: number[] = [];
        const minGap = Math.max(1, Math.floor(workDays.length / (remaining + 1)) - 1);

        for (let v = 0; v < remaining; v++) {
          const targetIdx = Math.floor(((v + 0.5) / remaining) * workDays.length);
          const bestIdx = findBestSlot(
            workDays,
            daySlots,
            targetIdx,
            prefDays,
            usedIndices,
            minGap,
            remaining,
            sdaiDates,
          );

          if (bestIdx !== -1) {
            daySlots[bestIdx] = {
              contract,
              type: 'VISITA_TECNICA',
              observation: `Visita ${visitCounter[contract.id].toString().padStart(2, '0')}`,
            };
            usedIndices.push(bestIdx);
            visitCounter[contract.id]++;
          }
        }
      }

      // ── ETAPA 3: Consolidar Mês ──
      monthlySdai.forEach((s) => {
        appointmentsToCreate.push({
          clientId: s.contract.clientId,
          professionalId: professional.id,
          contractId: s.contract.id,
          date: new Date(s.date),
          type: 'TESTE_SDAI',
          observation: 'Teste Geral SDAI (Trimestral)',
        });
      });

      daySlots.forEach((slot, idx) => {
        if (slot?.type === 'VISITA_TECNICA') {
          appointmentsToCreate.push({
            clientId: slot.contract.clientId,
            professionalId: professional.id,
            contractId: slot.contract.id,
            date: new Date(workDays[idx]),
            type: slot.type,
            observation: slot.observation,
          });
        }
      });
    }

    // ── OPERAÇÃO ATÔMICA ──
    // Aprendemos da pior forma: uma vez a geração falhou no meio e ficou metade
    // da agenda antiga com metade da nova. Transação resolve isso — ou gera tudo
    // ou não muda nada.
    const result = await prisma.$transaction(async (tx) => {
      // Apaga apenas a agenda do ano selecionado para o técnico
      await tx.appointment.deleteMany({
        where: {
          professionalId: professional.id,
          date: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1),
          },
        },
      });

      // createMany em vez de loop — a primeira versão criava um por um e
      // demorava ~8s pra 400 agendamentos. Com batch caiu pra <1s
      await tx.appointment.createMany({ data: appointmentsToCreate });
      return appointmentsToCreate;
    });

    return ApiUtils.success(
      {
        message: `${result.length} agendamentos gerados atómicamente`,
        count: result.length,
      },
      201,
    );
  } catch (error: unknown) {
    return ApiUtils.error('Erro estrutural ao gerar agenda', error);
  }
}

/**
 * GET e DELETE também utilizam ApiUtils agora
 */
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
      include: { client: true },
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
        date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      },
    });

    return ApiUtils.success({ message: `Agenda limpa (${deleted.count} removidos)` });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao limpar agenda', error);
  }
}

// ---
// Funções Auxiliares Sanitizadas
// ---

function checkMonthActivity(contract: ContractWithClient, month: number): boolean {
  if (contract.frequency === 'MONTHLY') return true;
  if (contract.targetMonths) {
    const enabledMonths = contract.targetMonths.split(',').map(Number);
    return enabledMonths.includes(month);
  }
  const period = FREQUENCY_PERIOD[contract.frequency ?? 'MONTHLY'] || 1;
  // Use the first character of the contract's stable ID to derive a
  // deterministic offset, avoiding dependence on sort-order (array index).
  const offset = contract.id.charCodeAt(0) % period;
  return month % period === offset;
}

function findBestSlot(
  workDays: Date[],
  daySlots: (SlotEntry | null)[],
  targetIdx: number,
  prefDays: number[],
  usedIndices: number[],
  minGap: number,
  totalVisits: number,
  sdaiDates?: Set<string>,
): number {
  let bestIdx = -1;
  let minDiff = Infinity;
  for (let i = 0; i < workDays.length; i++) {
    if (daySlots[i]) continue;
    // Skip workdays already reserved for an SDAI fallback appointment.
    if (sdaiDates?.has(toDateKey(workDays[i]))) continue;
    const meetsGap = usedIndices.every((idx) => Math.abs(idx - i) >= minGap);
    if (!meetsGap && totalVisits > 1) continue;
    const matchesPref = prefDays.length === 0 || prefDays.includes(workDays[i].getDay());
    const weight = matchesPref ? 0 : 1000;
    const diff = Math.abs(i - targetIdx) + weight;
    if (diff < minDiff) {
      minDiff = diff;
      bestIdx = i;
    }
  }
  if (bestIdx === -1) {
    minDiff = Infinity;
    for (let i = 0; i < workDays.length; i++) {
      if (!daySlots[i] && !sdaiDates?.has(toDateKey(workDays[i]))) {
        const diff = Math.abs(i - targetIdx);
        if (diff < minDiff) {
          minDiff = diff;
          bestIdx = i;
        }
      }
    }
  }
  return bestIdx;
}
