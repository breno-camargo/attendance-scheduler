import { ApiUtils, requireAuth } from '@/lib/api-utils';
import type { AppointmentType, GeneratedAppointment } from '@/lib/schedule-algorithm';
import { isGenerationError, runScheduleGeneration } from '@/lib/schedule-service';
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
  const authError = await requireAuth();
  if (authError) return authError;

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

    const { appointments, contractCount } = generation;
    const { byType, byMonth } = summarize(appointments);

    return ApiUtils.success({
      count: appointments.length,
      contractCount,
      byType,
      byMonth,
      appointments,
    });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao gerar prévia da agenda', error);
  }
}
