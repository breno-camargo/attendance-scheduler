import { ApiUtils, requireAuth } from '@/lib/api-utils';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const authError = await requireAuth();
  if (authError) return authError;

  const { id } = params;

  try {
    if (!id || !/^c[a-z0-9]{24}$/.test(id)) {
      return ApiUtils.error('ID inválido', null, 400);
    }
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        client: true,
        professional: true,
        appointments: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!contract) {
      return ApiUtils.error('Contrato não encontrado', null, 404);
    }

    return ApiUtils.success(contract);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao buscar dados do contrato para o relatório', error);
  }
}
