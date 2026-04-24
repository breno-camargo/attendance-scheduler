import { ApiUtils, requireAuth, requireAuthSession } from '@/lib/api-utils';
import { writeAuditLog } from '@/lib/audit-log';
import prisma from '@/lib/prisma';
import { clientSchema } from '@/lib/schemas';

/**
 * PUT /api/clients/[id]
 * Atualiza o nome do cliente e os dados do seu contrato principal.
 * Se o contrato não existir, cria um novo automaticamente.
 */
export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const authError = await requireAuth();
  if (authError) return authError;

  try {
    const { id } = params;
    if (!id || !/^c[a-z0-9]{24}$/.test(id)) {
      return ApiUtils.error('ID inválido', null, 400);
    }
    const body = await request.json();

    const validation = clientSchema.safeParse(body);
    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const data = validation.data;

    const client = await prisma.client.findUnique({
      where: { id },
      include: { contracts: { select: { id: true } } },
    });

    if (!client) {
      return ApiUtils.error('Cliente não encontrado', null, 404);
    }

    const contractId = client.contracts[0]?.id;

    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        name: ApiUtils.capitalizeName(data.name),
        phone: data.phone || null,
        contracts: contractId
          ? {
              update: {
                where: { id: contractId },
                data: {
                  professionalId: data.professionalId || null,
                  systemTypes: data.systemTypes || null,
                  visitsPerMonth: data.visitsPerMonth,
                  frequency: data.frequency || 'MONTHLY',
                  targetMonths: data.targetMonths || null,
                  preferredDays: data.preferredDays || null,
                },
              },
            }
          : {
              create: {
                professionalId: data.professionalId || null,
                systemTypes: data.systemTypes || 'SDAI',
                visitsPerMonth: data.visitsPerMonth,
                frequency: data.frequency || 'MONTHLY',
                targetMonths: data.targetMonths || null,
                preferredDays: data.preferredDays || null,
              },
            },
      },
      include: {
        contracts: {
          include: {
            professional: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
    });

    return ApiUtils.success(updatedClient);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao atualizar cliente', error);
  }
}

/**
 * DELETE /api/clients/[id]
 */
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAuthSession();
  if (auth.error) return auth.error;

  try {
    const { id } = params;
    if (!id || !/^c[a-z0-9]{24}$/.test(id)) {
      return ApiUtils.error('ID inválido', null, 400);
    }
    const existing = await prisma.client.findUnique({
      where: { id },
      select: { id: true, name: true, contracts: { select: { id: true } } },
    });
    if (!existing) {
      return ApiUtils.error('Cliente não encontrado', null, 404);
    }

    await prisma.client.delete({ where: { id } });
    await writeAuditLog({
      session: auth.session,
      action: 'CLIENT_DELETED',
      entityType: 'CLIENT',
      entityId: existing.id,
      entityLabel: existing.name,
      metadata: { contractCount: existing.contracts.length },
    });
    return ApiUtils.success({ success: true });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao excluir cliente', error);
  }
}
