import { ApiUtils, rateLimitKeyFromSession, requireAuthSession } from '@/lib/api-utils';
import { checkPreviewRateLimit } from '@/lib/rate-limit';
import type { AppointmentType, GeneratedAppointment } from '@/lib/schedule-algorithm';
import { isGenerationError, runScheduleGeneration } from '@/lib/schedule-service';
import { computeScheduleWarnings } from '@/lib/schedule-warnings';
import { generateScheduleSchema } from '@/lib/schemas';

export const dynamic = 'force-dynamic';

type TypeCount = Record<AppointmentType, number>;

function emptyTypeCount(): TypeCount {
  return { VISITA_TECNICA: 0, TESTE_SDAI: 0 };
}

function summarize(appointments: GeneratedAppointment[]) {
  const byType = emptyTypeCount();
  const byMonth: Record<number, TypeCount> = {};
  for (let m = 0; m < 12; m++) byMonth[m] = emptyTypeCount();

  for (const apt of appointments) {
    byType[apt.type]++;
    const month = apt.date.getUTCMonth();
    byMonth[month][apt.type]++;
  }

  return { byType, byMonth };
}

/**
 * POST /api/schedule/generate/preview
 * Simula a geração da agenda sem persistir nada. Mesma validação e mesmo
 * algoritmo do /generate — serve pro usuário revisar antes de confirmar.
 */
export async function POST(request: Request) {
  const auth = await requireAuthSession();
  if (auth.error) return auth.error;

  const rateKey = rateLimitKeyFromSession(auth.session, request);
  const allowed = await checkPreviewRateLimit(rateKey);
  if (!allowed) {
    return ApiUtils.error(
      'Muitas prévias em pouco tempo. Aguarde um instante e tente novamente.',
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
    const generation = await runScheduleGeneration(professionalId, year);
    if (isGenerationError(generation)) {
      return ApiUtils.error(generation.message, null, 404);
    }

    const { appointments, contractCount, existingCount, contracts, algorithmWarnings } = generation;
    const { byType, byMonth } = summarize(appointments);
    // Tier A (configuração) + Tier B (execução do algoritmo) — mesmo shape,
    // UI renderiza uniforme.
    const warnings = [...computeScheduleWarnings(contracts), ...algorithmWarnings];

    return ApiUtils.success({
      count: appointments.length,
      contractCount,
      existingCount,
      byType,
      byMonth,
      appointments,
      warnings,
    });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao gerar prévia da agenda', error);
  }
}
