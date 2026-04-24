import { parseSystemTypes } from './formatting';
import { parseNumberList } from './schedule-algorithm';

export type ScheduleWarningCode =
  // Tier A — configuração dos contratos (antes do algoritmo rodar):
  | 'NON_MONTHLY_SDAI'
  | 'NO_MONTHLY_VISITS'
  | 'INVALID_TARGET_MONTHS'
  // Tier B — execução do algoritmo (o que de fato aconteceu):
  | 'SDAI_FELL_ON_WEEKDAY'
  | 'UNPLACED_VISITS';

export interface ScheduleWarning {
  code: ScheduleWarningCode;
  contractId: string;
  clientName?: string;
  message: string;
  // Campos opcionais usados só por alguns codes do Tier B:
  date?: string; // SDAI_FELL_ON_WEEKDAY (ISO yyyy-mm-dd)
  month?: number; // UNPLACED_VISITS (0-11)
  missingCount?: number; // UNPLACED_VISITS
}

export interface WarningContract {
  id: string;
  frequency: string | null;
  systemTypes: string | null;
  visitsPerMonth: number;
  targetMonths: string | null;
  client?: { name: string } | null;
}

// Avisos informativos pra mostrar no preview. Não bloqueiam geração — servem
// pra dar chance de corrigir configuração errada antes de confirmar.
// Função pura: entra lista de contratos, sai lista de warnings.
export function computeScheduleWarnings(contracts: WarningContract[]): ScheduleWarning[] {
  const warnings: ScheduleWarning[] = [];

  for (const contract of contracts) {
    const clientName = contract.client?.name;
    const isMonthly = contract.frequency === 'MONTHLY';

    // SDAI em contrato não-mensal: algoritmo só agenda testes SDAI automaticamente
    // pra MONTHLY. Em outras frequências, o responsável precisa inserir manualmente.
    if (!isMonthly && parseSystemTypes(contract.systemTypes).includes('SDAI')) {
      warnings.push({
        code: 'NON_MONTHLY_SDAI',
        contractId: contract.id,
        clientName,
        message: 'SDAI em contratos não mensais deve ser agendado manualmente.',
      });
    }

    // Monthly sem visitas: contrato gera zero appointments — provavelmente erro.
    if (isMonthly && contract.visitsPerMonth <= 0) {
      warnings.push({
        code: 'NO_MONTHLY_VISITS',
        contractId: contract.id,
        clientName,
        message: 'Contrato mensal sem visitas configuradas.',
      });
    }

    // targetMonths preenchido mas sem nenhum mês válido (0..11). Diferente de
    // vazio/ausente (que cai no offset automático): aqui o contrato não vai
    // agendar em nenhum mês, porque checkMonthActivity usa a lista literal.
    if (!isMonthly && contract.targetMonths) {
      const parsed = parseNumberList(contract.targetMonths);
      const validMonths = parsed.filter((m) => m >= 0 && m <= 11);
      if (validMonths.length === 0) {
        warnings.push({
          code: 'INVALID_TARGET_MONTHS',
          contractId: contract.id,
          clientName,
          message: 'Meses-alvo inválidos — o contrato não será agendado em nenhum mês.',
        });
      }
    }
  }

  return warnings;
}
