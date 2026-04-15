import { ApiUtils, requireAuth } from '@/lib/api-utils';
import { getHolidaysForYear } from '@/lib/holidays';
import prisma from '@/lib/prisma';
import { appointmentPatchSchema } from '@/lib/schemas';

/**
 * DELETE /api/schedule/[id]
 * Remove um agendamento específico.
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { id } = params;
    if (!id || !/^c[a-z0-9]{24}$/.test(id)) {
      return ApiUtils.error('ID inválido', null, 400);
    }
    const existing = await prisma.appointment.findUnique({ where: { id } });
    if (!existing) {
      return ApiUtils.error('Agendamento não encontrado', null, 404);
    }
    await prisma.appointment.delete({ where: { id } });
    return ApiUtils.success({ success: true });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao excluir agendamento', error);
  }
}

/**
 * PATCH /api/schedule/[id]
 * Atualiza parcialmente um agendamento (tipo, observação ou data).
 */
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { id } = params;
    if (!id || !/^c[a-z0-9]{24}$/.test(id)) {
      return ApiUtils.error('ID inválido', null, 400);
    }
    const body = await request.json();

    const validation = appointmentPatchSchema.safeParse(body);
    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const { type, observation, date } = validation.data;

    // Bloqueia mover para feriado
    if (date) {
      const newDate = new Date(date);
      const year = newDate.getUTCFullYear();
      const dateKey = newDate.toISOString().split('T')[0];
      const holidayKeys = new Set(getHolidaysForYear(year).map((h) => h.date));
      if (holidayKeys.has(dateKey)) {
        return ApiUtils.error('Não é possível mover para um feriado', null, 400);
      }
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...(type !== undefined && { type }),
        ...(observation !== undefined && { observation }),
        ...(date !== undefined && { date: new Date(date) }),
      },
    });

    // Após mover data, renumerar todas as visitas do mesmo contrato em ordem cronológica
    if (date && updated.contractId) {
      const allVisits = await prisma.appointment.findMany({
        where: {
          contractId: updated.contractId,
          type: 'VISITA_TECNICA',
        },
        orderBy: { date: 'asc' },
        select: { id: true, observation: true },
      });

      const updates = allVisits
        .map((v, i) => ({ id: v.id, obs: `Visita ${(i + 1).toString().padStart(2, '0')}`, old: v.observation }))
        .filter((v) => v.obs !== v.old);

      if (updates.length > 0) {
        await prisma.$transaction(
          updates.map((v) => prisma.appointment.update({ where: { id: v.id }, data: { observation: v.obs } }))
        );
      }
    }

    return ApiUtils.success(updated);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao atualizar agendamento', error);
  }
}
