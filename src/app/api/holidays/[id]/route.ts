import { ApiUtils, requireAuth } from '@/lib/api-utils';
import prisma from '@/lib/prisma';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { id } = await params;
    if (!id || !/^c[a-z0-9]{24}$/.test(id)) {
      return ApiUtils.error('ID inválido', null, 400);
    }
    const holiday = await prisma.holiday.findUnique({ where: { id } });
    if (!holiday) {
      return ApiUtils.error('Feriado não encontrado', null, 404);
    }
    if (holiday.fixed) {
      return ApiUtils.error('Feriados fixos nacionais não podem ser excluídos', null, 403);
    }
    await prisma.holiday.delete({ where: { id } });
    return ApiUtils.success({ deleted: true });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao excluir feriado', error);
  }
}
