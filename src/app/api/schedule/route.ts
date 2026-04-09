import { ApiUtils, requireAuth } from '@/lib/api-utils';
import { getHolidaysForYear } from '@/lib/holidays';
import prisma from '@/lib/prisma';
import { appointmentSchema } from '@/lib/schemas';

/**
 * POST /api/schedule
 * Cria um agendamento manual (visita técnica ou teste SDAI).
 */
export async function POST(request: Request) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const body = await request.json();

    const validation = appointmentSchema.safeParse(body);
    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const data = validation.data;

    // Bloqueia agendamento em feriado
    const appointmentDate = new Date(data.date);
    const year = appointmentDate.getUTCFullYear();
    const dateKey = appointmentDate.toISOString().split('T')[0];
    const holidayKeys = new Set(getHolidaysForYear(year).map((h) => h.date));
    if (holidayKeys.has(dateKey)) {
      return ApiUtils.error('Não é possível agendar em um feriado', null, 400);
    }

    const appointment = await prisma.appointment.create({
      data: {
        clientId: data.clientId,
        professionalId: data.professionalId,
        contractId: data.contractId || null,
        date: new Date(data.date),
        type: data.type,
        observation: data.observation || '',
      },
    });

    return ApiUtils.success(appointment, 201);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao criar agendamento', error);
  }
}
