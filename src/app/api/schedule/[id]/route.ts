import { ApiUtils, requireAuth } from '@/lib/api-utils';
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

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...(type !== undefined && { type }),
        ...(observation !== undefined && { observation }),
        ...(date !== undefined && { date: new Date(date) }),
      },
    });

    return ApiUtils.success(updated);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao atualizar agendamento', error);
  }
}
