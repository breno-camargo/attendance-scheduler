import { getSaturdays, isWeekend, toDateKey } from './date-utils';
import { parseSystemTypes } from './formatting';

export const FREQUENCY_PERIOD: Record<string, number> = {
  MONTHLY: 1,
  BIMONTHLY: 2,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

export interface ScheduleContract {
  id: string;
  clientId: string;
  frequency: string | null;
  targetMonths: string | null;
  preferredDays: string | null;
  systemTypes: string | null;
  visitsPerMonth: number;
}

export type AppointmentType = 'VISITA_TECNICA' | 'TESTE_SDAI';

export interface GeneratedAppointment {
  clientId: string;
  contractId: string;
  date: Date;
  type: AppointmentType;
  observation?: string;
}

interface SlotEntry<C extends ScheduleContract> {
  contract: C;
  type: AppointmentType;
  observation?: string;
}

export function parseNumberList(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(Number)
    .filter((value) => Number.isInteger(value) && value >= 0);
}

function hasSdaiSystem(systemTypes: string | null): boolean {
  return parseSystemTypes(systemTypes).includes('SDAI');
}

/**
 * Decide se o contrato tem visita no mês dado.
 * - MONTHLY: sempre ativo.
 * - targetMonths definido: usa a lista (ex: "0,6" = Jan e Jul).
 * - Fallback: offset determinístico via charCodeAt do ID pra evitar clustering.
 */
export function checkMonthActivity(
  contract: Pick<ScheduleContract, 'id' | 'frequency' | 'targetMonths'>,
  month: number,
): boolean {
  if (contract.frequency === 'MONTHLY') return true;
  if (contract.targetMonths) {
    const enabledMonths = parseNumberList(contract.targetMonths);
    return enabledMonths.includes(month);
  }
  const period = FREQUENCY_PERIOD[contract.frequency ?? 'MONTHLY'] || 1;
  const offset = contract.id.charCodeAt(0) % period;
  return month % period === offset;
}

/**
 * Encontra o índice do melhor dia útil pra alocar uma visita.
 * Respeita gap mínimo entre visitas e prioriza preferredDays (peso 0 vs 1000).
 * Se não achar com gap, faz fallback ignorando gap.
 */
export function findBestSlot<T>(
  workDays: Date[],
  daySlots: (T | null)[],
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
    if (sdaiDates?.has(toDateKey(workDays[i]))) continue;
    const meetsGap = usedIndices.every((idx) => Math.abs(idx - i) >= minGap);
    if (!meetsGap && totalVisits > 1) continue;
    const matchesPref = prefDays.length === 0 || prefDays.includes(workDays[i].getUTCDay());
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

/**
 * Etapa 1: pré-aloca testes SDAI trimestrais em sábados, com rotação
 * em 3 grupos pra evitar clustering. Se nenhum sábado disponível,
 * faz fallback pra dia útil.
 */
function allocateSdaiDates<C extends ScheduleContract>(
  contracts: C[],
  year: number,
  saturdaysByMonth: Date[][],
  isHoliday: (date: Date) => boolean,
  getWorkDays: (year: number, month: number) => Date[],
): Record<number, { contract: C; date: Date }[]> {
  const sdaiContracts = contracts.filter(
    (c) => c.frequency === 'MONTHLY' && hasSdaiSystem(c.systemTypes),
  );
  const sdaiSchedule: Record<number, { contract: C; date: Date }[]> = {};
  const used = new Set<string>();

  for (let idx = 0; idx < sdaiContracts.length; idx++) {
    const contract = sdaiContracts[idx];
    const rotationGroup = idx % 3;
    for (let month = rotationGroup; month < 12; month += 3) {
      const saturdays = saturdaysByMonth[month];

      // Offset determinístico (idx + mês + charCodeAt) — varia entre contratos
      // e meses sem ser aleatório (mesma geração 2x dá mesma agenda).
      const startOffset =
        saturdays.length > 0 ? (idx + month + contract.id.charCodeAt(0)) % saturdays.length : 0;

      // Folga mínima entre testes SDAI no mesmo mês: mais de 7 dias. Ex: se um
      // teste cai no dia 4, o próximo sábado (dia 11) é pulado — mínimo dia 18.
      // Só aplica quando já há algum SDAI no mês (contratos do mesmo grupo).
      const MIN_GAP_MS = 7 * 24 * 60 * 60 * 1000;
      const monthEntries = sdaiSchedule[month] || [];
      const respectsGap = (sat: Date) =>
        monthEntries.every((e) => Math.abs(e.date.getTime() - sat.getTime()) > MIN_GAP_MS);

      let chosenDate: Date | undefined;
      // 1ª passada: respeitando gap
      for (let i = 0; i < saturdays.length; i++) {
        const sat = saturdays[(startOffset + i) % saturdays.length];
        if (used.has(toDateKey(sat)) || isHoliday(sat)) continue;
        if (!respectsGap(sat)) continue;
        chosenDate = sat;
        break;
      }
      // Fallback 1: ignora gap, aceita sábado adjacente (mantém invariante "sábado")
      if (!chosenDate) {
        for (let i = 0; i < saturdays.length; i++) {
          const sat = saturdays[(startOffset + i) % saturdays.length];
          if (!used.has(toDateKey(sat)) && !isHoliday(sat)) {
            chosenDate = sat;
            break;
          }
        }
      }
      // Fallback 2: dia útil (nenhum sábado disponível)
      if (!chosenDate) {
        const workDays = getWorkDays(year, month);
        chosenDate = workDays.find((d) => !used.has(toDateKey(d)));
      }

      if (chosenDate) {
        used.add(toDateKey(chosenDate));
        if (!sdaiSchedule[month]) sdaiSchedule[month] = [];
        sdaiSchedule[month].push({ contract, date: chosenDate });
      }
    }
  }
  return sdaiSchedule;
}

/**
 * Etapa 2: distribui visitas técnicas pelos dias úteis do mês,
 * respeitando SDAI já alocado, gap mínimo e preferredDays.
 * Retorna os apontamentos (VISITA_TECNICA) criados no mês — SDAI é emitido separadamente.
 */
function distributeMonthVisits<C extends ScheduleContract>(
  contracts: C[],
  month: number,
  workDays: Date[],
  monthlySdai: { contract: C; date: Date }[],
  visitCounter: Record<string, number>,
): GeneratedAppointment[] {
  const daySlots: (SlotEntry<C> | null)[] = new Array(workDays.length).fill(null);
  const workDayIndex = new Map(workDays.map((d, i) => [toDateKey(d), i]));

  monthlySdai.forEach((s) => {
    const idx = workDayIndex.get(toDateKey(s.date));
    if (idx !== undefined) daySlots[idx] = { contract: s.contract, type: 'TESTE_SDAI' };
  });

  const sdaiDates = new Set<string>(monthlySdai.map((s) => toDateKey(s.date)));

  const sortedContracts = [...contracts].sort((a, b) => {
    const aPref = !!a.preferredDays;
    const bPref = !!b.preferredDays;
    if (aPref !== bPref) return aPref ? -1 : 1;
    return (a.visitsPerMonth || 0) - (b.visitsPerMonth || 0);
  });

  for (const contract of sortedContracts) {
    if (!checkMonthActivity(contract, month)) continue;

    const hasSdaiThisMonth = monthlySdai.some((s) => s.contract.id === contract.id);
    const visitsGoal = contract.visitsPerMonth ?? 1;
    if (visitsGoal <= 0) continue;
    const remaining = hasSdaiThisMonth
      ? visitsGoal - 1
      : contract.frequency === 'MONTHLY'
        ? visitsGoal
        : 1;
    if (remaining <= 0) continue;

    const prefDays = parseNumberList(contract.preferredDays);
    const usedIndices: number[] = [];

    if (hasSdaiThisMonth) {
      const sdaiEntry = monthlySdai.find((s) => s.contract.id === contract.id);
      if (sdaiEntry) {
        let sdaiIdx = workDayIndex.get(toDateKey(sdaiEntry.date)) ?? -1;
        if (sdaiIdx === -1) {
          // SDAI caiu no sábado — usa dia útil mais próximo como âncora de espaçamento
          const sdaiTime = sdaiEntry.date.getTime();
          let closestDist = Infinity;
          for (let wi = 0; wi < workDays.length; wi++) {
            const dist = Math.abs(workDays[wi].getTime() - sdaiTime);
            if (dist < closestDist) {
              closestDist = dist;
              sdaiIdx = wi;
            }
          }
        }
        if (sdaiIdx !== -1) usedIndices.push(sdaiIdx);
      }
    }

    const totalVisitsInMonth = remaining + usedIndices.length;
    const minGap = Math.max(1, Math.floor(workDays.length / (totalVisitsInMonth + 1)) - 1);

    for (let v = 0; v < remaining; v++) {
      const slotNum = usedIndices.length + v;
      const targetIdx = Math.floor(((slotNum + 0.5) / totalVisitsInMonth) * workDays.length);
      const bestIdx = findBestSlot(
        workDays,
        daySlots,
        targetIdx,
        prefDays,
        usedIndices,
        minGap,
        totalVisitsInMonth,
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

  const visits: GeneratedAppointment[] = [];
  daySlots.forEach((slot, idx) => {
    if (slot?.type === 'VISITA_TECNICA') {
      visits.push({
        clientId: slot.contract.clientId,
        contractId: slot.contract.id,
        date: new Date(workDays[idx]),
        type: 'VISITA_TECNICA',
        observation: slot.observation,
      });
    }
  });
  return visits;
}

/**
 * Renumera observation das visitas em ordem cronológica por contrato.
 * A distribuição por mês não respeita ordem global, então corrige aqui.
 */
function renumberVisitsChronologically(appointments: GeneratedAppointment[]): void {
  const visitsByContract = new Map<string, GeneratedAppointment[]>();
  for (const apt of appointments) {
    if (apt.type !== 'VISITA_TECNICA') continue;
    if (!visitsByContract.has(apt.contractId)) visitsByContract.set(apt.contractId, []);
    visitsByContract.get(apt.contractId)!.push(apt);
  }
  visitsByContract.forEach((visits) => {
    visits.sort((a, b) => a.date.getTime() - b.date.getTime());
    visits.forEach((v, i) => {
      v.observation = `Visita ${(i + 1).toString().padStart(2, '0')}`;
    });
  });
}

/**
 * Gera a agenda anual completa para um conjunto de contratos.
 * Função pura: recebe contratos + feriados, devolve apontamentos.
 * Não faz I/O, não depende de Prisma.
 */
export function generateYearSchedule<C extends ScheduleContract>(
  contracts: C[],
  year: number,
  holidayKeys: Set<string>,
): GeneratedAppointment[] {
  const isHoliday = (date: Date) => holidayKeys.has(toDateKey(date));

  const getWorkDays = (y: number, month: number): Date[] => {
    const days: Date[] = [];
    const totalDays = new Date(Date.UTC(y, month + 1, 0)).getUTCDate();
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(Date.UTC(y, month, d));
      if (!isWeekend(date) && !isHoliday(date)) days.push(date);
    }
    return days;
  };

  const saturdaysByMonth = Array.from({ length: 12 }, (_, m) => getSaturdays(year, m));
  const sdaiSchedule = allocateSdaiDates(contracts, year, saturdaysByMonth, isHoliday, getWorkDays);

  const appointments: GeneratedAppointment[] = [];
  const visitCounter: Record<string, number> = {};
  contracts.forEach((c) => (visitCounter[c.id] = 1));

  for (let month = 0; month < 12; month++) {
    const workDays = getWorkDays(year, month);
    const monthlySdai = sdaiSchedule[month] || [];

    monthlySdai.forEach((s) => {
      appointments.push({
        clientId: s.contract.clientId,
        contractId: s.contract.id,
        date: new Date(s.date),
        type: 'TESTE_SDAI',
        observation: 'Teste Geral SDAI (Trimestral)',
      });
    });

    const visits = distributeMonthVisits(contracts, month, workDays, monthlySdai, visitCounter);
    appointments.push(...visits);
  }

  renumberVisitsChronologically(appointments);
  return appointments;
}
