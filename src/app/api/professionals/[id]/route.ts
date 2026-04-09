import { ApiUtils, getScopedProfessionalIds, requireAuthWithScope } from '@/lib/api-utils';
import prisma from '@/lib/prisma';
import { professionalSchema } from '@/lib/schemas';

/**
 * PUT /api/professionals/[id]
 * Atualiza os dados de um técnico existente.
 */
export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth } = result;

  try {
    const { id } = params;
    if (!id || !/^c[a-z0-9]{24}$/.test(id)) {
      return ApiUtils.error('ID inválido', null, 400);
    }

    // Verifica se o profissional está no escopo
    const profIds = await getScopedProfessionalIds(auth);
    if (profIds && !profIds.includes(id)) {
      return ApiUtils.error('Você não tem permissão para editar este técnico', null, 403);
    }
    const body = await request.json();

    const validation = professionalSchema.safeParse(body);
    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const data = validation.data;

    const email = data.email.includes('@')
      ? data.email
      : `${data.email}@${process.env.EMAIL_DOMAIN || 'compasss.com.br'}`;

    const updated = await prisma.professional.update({
      where: { id },
      data: {
        name: ApiUtils.capitalizeName(data.name),
        email,
        phone: data.phone || null,
        supervisorId: body.supervisorId !== undefined ? (body.supervisorId || null) : undefined,
      },
    });

    return ApiUtils.success(updated);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao editar técnico', error);
  }
}

/**
 * DELETE /api/professionals/[id]
 */
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth } = result;

  try {
    const { id } = params;
    if (!id || !/^c[a-z0-9]{24}$/.test(id)) {
      return ApiUtils.error('ID inválido', null, 400);
    }

    const profIds = await getScopedProfessionalIds(auth);
    if (profIds && !profIds.includes(id)) {
      return ApiUtils.error('Você não tem permissão para excluir este técnico', null, 403);
    }

    await prisma.$transaction([
      prisma.availability.deleteMany({ where: { professionalId: id } }),
      prisma.contract.updateMany({
        where: { professionalId: id },
        data: { professionalId: null },
      }),
      prisma.appointment.updateMany({
        where: { professionalId: id },
        data: { professionalId: null },
      }),
      prisma.professional.delete({ where: { id } }),
    ]);

    return ApiUtils.success({ success: true });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao excluir técnico', error);
  }
}
