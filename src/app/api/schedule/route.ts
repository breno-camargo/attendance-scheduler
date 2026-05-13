import {
  ApiUtils,
  requireAuthWithScope,
  requireClientInScope,
  requireContractInScope,
  requireProfessionalInScope,
} from '@/lib/api-utils';
import { getHolidaysForYear } from '@/lib/holidays';
import prisma from '@/lib/prisma';
import { renumberContractVisits } from '@/lib/schedule-service';
import { appointmentSchema } from '@/lib/schemas';

/**
 * POST /api/schedule
 * Cria um agendamento manual (visita técnica ou teste SDAI).
 */
export async function POST(request: Request) {
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth } = result;

  try {
    const body = await request.json();

    const validation = appointmentSchema.safeParse(body);
    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const data = validation.data;
    const professionalScopeError = await requireProfessionalInScope(auth, data.professionalId);
    if (professionalScopeError) return professionalScopeError;

    const clientScopeError = await requireClientInScope(auth, data.clientId);
    if (clientScopeError) return clientScopeError;

    if (data.contractId) {
      const contractScopeError = await requireContractInScope(auth, data.contractId);
      if (contractScopeError) return contractScopeError;

      const contract = await prisma.contract.findUnique({
        where: { id: data.contractId },
        select: { clientId: true, professionalId: true },
      });
      if (!contract) {
        return ApiUtils.error('Contrato não encontrado', null, 404);
      }
      if (contract.clientId !== data.clientId) {
        return ApiUtils.error('Contrato não pertence ao cliente informado', null, 400);
      }
      if (!contract.professionalId) {
        return ApiUtils.error('Contrato sem técnico atribuído', null, 400);
      }
      if (contract.professionalId !== data.professionalId) {
        return ApiUtils.error('Contrato não pertence ao técnico informado', null, 400);
      }
    }

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

    // Renumera visitas do contrato no ano da inserção — a inserção pode cair
    // no meio da sequência, e sem renumerar a observation default fica fora de
    // ordem cronológica. Só roda se o usuário não passou observation custom.
    if (appointment.contractId && appointment.type === 'VISITA_TECNICA' && !data.observation) {
      await renumberContractVisits(appointment.contractId, appointment.date.getUTCFullYear());
    }

    return ApiUtils.success(appointment, 201);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao criar agendamento', error);
  }
}
