import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────
// Utilitários de Data
// ─────────────────────────────────────────────────────────────

const FIXED_HOLIDAYS = [
  "01-01",
  "02-16",
  "02-17",
  "04-03",
  "04-21",
  "05-01",
  "06-04",
  "09-07",
  "10-12",
  "11-02",
  "11-15",
  "12-25",
];

const isWeekend = (date: Date) => date.getDay() === 0 || date.getDay() === 6;

const isHoliday = (date: Date) => {
  const mmdd = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return FIXED_HOLIDAYS.includes(mmdd);
};

const getWorkDays = (year: number, month: number): Date[] => {
  const days: Date[] = [];
  const totalDays = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month, d);
    if (!isWeekend(date) && !isHoliday(date)) days.push(date);
  }
  return days;
};

const getSaturdays = (year: number, month: number): Date[] => {
  const sats: Date[] = [];
  const totalDays = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= totalDays; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === 6) sats.push(date);
  }
  return sats;
};

const toDateKey = (date: Date) => date.toISOString().split("T")[0];

// ─────────────────────────────────────────────────────────────
// Constantes de Frequência
// ─────────────────────────────────────────────────────────────

const FREQUENCY_PERIOD: Record<string, number> = {
  MONTHLY: 1,
  BIMONTHLY: 2,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

// ─────────────────────────────────────────────────────────────
// POST — Gerar Agenda Automática
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/schedule/generate
 * Gera a agenda anual completa para um técnico.
 *
 * Fluxo:
 * 1. Remove todos os agendamentos existentes do técnico naquele ano
 * 2. Pré-aloca testes SDAI trimestrais (preferencialmente aos sábados)
 * 3. Distribui visitas técnicas nos dias úteis restantes
 * 4. Respeita dias de preferência do contrato e espaçamento mínimo
 */
export async function POST(request: Request) {
  try {
    const { professionalId, year: requestedYear } = await request.json();
    if (!professionalId) {
      return NextResponse.json(
        { error: "professionalId obrigatório" },
        { status: 400 },
      );
    }

    const year = parseInt(requestedYear) || 2026;

    const professional = await prisma.professional.findUnique({
      where: { id: professionalId },
      include: { contracts: { include: { client: true } } },
    });

    if (!professional || professional.contracts.length === 0) {
      return NextResponse.json(
        { error: "Técnico não encontrado ou sem contratos vinculados" },
        { status: 404 },
      );
    }

    const contracts = professional.contracts as any[];

    // Limpa agenda do ano
    await prisma.appointment.deleteMany({
      where: {
        professionalId: professional.id,
        date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      },
    });

    const appointmentsToCreate: any[] = [];
    const visitCounter: Record<string, number> = {};
    contracts.forEach((c) => (visitCounter[c.id] = 1));

    // ── ETAPA 1: Pré-alocar Testes SDAI (Trimestrais, Sábados) ──

    const sdaiSchedule: Record<number, { contract: any; date: Date }[]> = {};
    const usedSdaiDates = new Set<string>();

    contracts
      .filter(
        (c) => c.frequency === "MONTHLY" && c.systemTypes?.includes("SDAI"),
      )
      .forEach((contract, idx) => {
        const rotationGroup = idx % 3;

        for (let month = rotationGroup; month < 12; month += 3) {
          const saturdays = getSaturdays(year, month);

          // Prefere sábados próximos ao dia 25
          const sortedSats = [...saturdays].sort(
            (a, b) => Math.abs(a.getDate() - 25) - Math.abs(b.getDate() - 25),
          );

          let chosenDate = sortedSats.find(
            (s) => !usedSdaiDates.has(toDateKey(s)),
          );

          // Fallback: dia útil disponível
          if (!chosenDate) {
            const workDays = getWorkDays(year, month);
            chosenDate = workDays.find((d) => !usedSdaiDates.has(toDateKey(d)));
          }

          if (chosenDate) {
            usedSdaiDates.add(toDateKey(chosenDate));
            if (!sdaiSchedule[month]) sdaiSchedule[month] = [];
            sdaiSchedule[month].push({ contract, date: chosenDate });
          }
        }
      });

    // ── ETAPA 2: Distribuir Visitas Técnicas por Mês ──

    for (let month = 0; month < 12; month++) {
      const workDays = getWorkDays(year, month);
      const daySlots: (any | null)[] = new Array(workDays.length).fill(null);
      const monthlySdai = sdaiSchedule[month] || [];

      // Marca slots SDAI que caem em dias úteis
      monthlySdai.forEach((s) => {
        const idx = workDays.findIndex(
          (d) => toDateKey(d) === toDateKey(s.date),
        );
        if (idx !== -1)
          daySlots[idx] = { contract: s.contract, type: "TESTE_SDAI" };
      });

      // Ordena contratos: com preferência de dia primeiro, depois menor frequência
      const sortedContracts = [...contracts].sort((a, b) => {
        const aPref = !!a.preferredDays;
        const bPref = !!b.preferredDays;
        if (aPref !== bPref) return aPref ? -1 : 1;
        return (a.visitsPerMonth || 0) - (b.visitsPerMonth || 0);
      });

      sortedContracts.forEach((contract, cIdx) => {
        // Verifica se o contrato está ativo neste mês
        const isActive = checkMonthActivity(contract, month, cIdx);
        if (!isActive) return;

        const hasSdaiThisMonth = monthlySdai.some(
          (s) => s.contract.id === contract.id,
        );
        const visitsGoal = contract.visitsPerMonth || 1;
        const remaining = hasSdaiThisMonth
          ? visitsGoal - 1
          : contract.frequency === "MONTHLY"
            ? visitsGoal
            : 1;

        if (remaining <= 0) return;

        const prefDays = contract.preferredDays?.split(",").map(Number) || [];
        const usedIndices: number[] = [];
        const minGap = Math.max(
          1,
          Math.floor(workDays.length / (remaining + 1)) - 1,
        );

        for (let v = 0; v < remaining; v++) {
          const targetIdx = Math.floor(
            ((v + 0.5) / remaining) * workDays.length,
          );
          const bestIdx = findBestSlot(
            workDays,
            daySlots,
            targetIdx,
            prefDays,
            usedIndices,
            minGap,
            remaining,
          );

          if (bestIdx !== -1) {
            daySlots[bestIdx] = {
              contract,
              type: "VISITA_TECNICA",
              observation: `Visita ${visitCounter[contract.id].toString().padStart(2, "0")}`,
            };
            usedIndices.push(bestIdx);
            visitCounter[contract.id]++;
          }
        }
      });

      // ── ETAPA 3: Consolidar Agendamentos do Mês ──

      // Testes SDAI (incluindo sábados)
      monthlySdai.forEach((s) => {
        appointmentsToCreate.push({
          clientId: s.contract.clientId,
          professionalId: professional.id,
          contractId: s.contract.id,
          date: new Date(s.date),
          type: "TESTE_SDAI",
          observation: "Teste Geral SDAI (Trimestral)",
        });
      });

      // Visitas Técnicas
      daySlots.forEach((slot, idx) => {
        if (slot?.type === "VISITA_TECNICA") {
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

    // Inserção em lote via transação
    const inserted = await prisma.$transaction(
      appointmentsToCreate.map((data) => prisma.appointment.create({ data })),
    );

    return NextResponse.json(
      {
        message: `${inserted.length} agendamentos gerados com sucesso`,
        appointments: inserted,
      },
      { status: 201 },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro interno ao gerar agenda", details: error.message },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GET — Listar Agendamentos do Técnico
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/schedule/generate?professionalId=xxx
 * Retorna todos os agendamentos de um técnico, ordenados por data.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get("professionalId");

    if (!professionalId) return NextResponse.json([]);

    const appointments = await prisma.appointment.findMany({
      where: { professionalId },
      include: { client: true },
      orderBy: { date: "asc" },
    });

    return NextResponse.json(appointments);
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao listar agendamentos", details: error.message },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE — Limpar Agenda do Ano
// ─────────────────────────────────────────────────────────────

/**
 * DELETE /api/schedule/generate?professionalId=xxx&year=2026
 * Remove todos os agendamentos do técnico para o ano especificado.
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const professionalId = searchParams.get("professionalId");
    const year = parseInt(searchParams.get("year") || "2026");

    if (!professionalId) {
      return NextResponse.json(
        { error: "professionalId obrigatório" },
        { status: 400 },
      );
    }

    await prisma.appointment.deleteMany({
      where: {
        professionalId,
        date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
      },
    });

    return NextResponse.json({ message: "Agenda limpa com sucesso" });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Erro ao limpar agenda", details: error.message },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Funções Auxiliares
// ─────────────────────────────────────────────────────────────

/**
 * Verifica se um contrato está ativo em determinado mês,
 * baseando-se na frequência e nos meses-alvo configurados.
 */
function checkMonthActivity(
  contract: any,
  month: number,
  contractIndex: number,
): boolean {
  if (contract.frequency === "MONTHLY") return true;

  if (contract.targetMonths) {
    const enabledMonths = contract.targetMonths.split(",").map(Number);
    return enabledMonths.includes(month);
  }

  // Rotação padrão quando meses-alvo não foram definidos
  const period = FREQUENCY_PERIOD[contract.frequency] || 1;
  return month % period === contractIndex % period;
}

/**
 * Encontra o melhor slot disponível para agendar uma visita.
 * Prioriza: dias de preferência > proximidade ao ponto ideal > qualquer dia livre.
 */
function findBestSlot(
  workDays: Date[],
  daySlots: (any | null)[],
  targetIdx: number,
  prefDays: number[],
  usedIndices: number[],
  minGap: number,
  totalVisits: number,
): number {
  let bestIdx = -1;
  let minDiff = Infinity;

  // Primeira tentativa: respeita gap mínimo e preferências
  for (let i = 0; i < workDays.length; i++) {
    if (daySlots[i]) continue;

    const meetsGap = usedIndices.every((idx) => Math.abs(idx - i) >= minGap);
    if (!meetsGap && totalVisits > 1) continue;

    const matchesPref =
      prefDays.length === 0 || prefDays.includes(workDays[i].getDay());
    const weight = matchesPref ? 0 : 1000;
    const diff = Math.abs(i - targetIdx) + weight;

    if (diff < minDiff) {
      minDiff = diff;
      bestIdx = i;
    }
  }

  // Fallback: qualquer slot livre, sem restrição de gap
  if (bestIdx === -1) {
    minDiff = Infinity;
    for (let i = 0; i < workDays.length; i++) {
      if (!daySlots[i]) {
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
