import { ApiUtils, requireAuth } from '@/lib/api-utils';
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
