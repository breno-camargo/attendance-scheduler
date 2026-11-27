import { ApiUtils, requireAuthWithScope } from '@/lib/api-utils';
import { migrateRole, TECHNICAL_LEADER_ROLE, UNIQUE_ROLES } from '@/lib/constants';
import prisma from '@/lib/prisma';
import { internalContactSchema } from '@/lib/schemas';
import { TeamHierarchyError, validateTeamSupervisor } from '@/lib/team-hierarchy';

/**
 * GET /api/internal-contacts/[id]
 * Retorna dados completos (sem máscara) — usado nos formulários de edição.
 */
export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;

  if (result.auth.scope === 'filtered' && params.id !== result.auth.internalContactId) {
    return ApiUtils.error('Sem permissão', null, 403);
  }

  if (!params.id || !/^c[a-z0-9]{24}$/.test(params.id)) {
    return ApiUtils.error('ID inválido', null, 400);
  }

  const contact = await prisma.internalContact.findUnique({ where: { id: params.id } });
  if (!contact) return ApiUtils.error('Contato não encontrado', null, 404);
  return ApiUtils.success(contact);
}

export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  // Escopo filtrado: só pode editar o próprio contato
  if (result.auth.scope === 'filtered' && params.id !== result.auth.internalContactId) {
    return ApiUtils.error('Você só pode editar seu próprio contato', null, 403);
  }

  try {
    if (!params.id || !/^c[a-z0-9]{24}$/.test(params.id)) {
      return ApiUtils.error('ID inválido', null, 400);
    }
    const body = await request.json();

    const validation = internalContactSchema.safeParse(body);
    if (!validation.success) {
      return ApiUtils.error('Dados inválidos', validation.error.format(), 400);
    }

    const data = validation.data;
    const role =
      result.auth.scope === 'all' && data.role !== undefined ? migrateRole(data.role) : undefined;

    // Transaction para garantir atomicidade na validação de cargo único
    const contact = await prisma.$transaction(
      async (tx) => {
        if (result.auth.scope === 'all') {
          await validateTeamSupervisor(tx, role ?? '', data.supervisorId, params.id);
          if (
            role !== undefined &&
            role !== 'Supervisor' &&
            (await tx.internalContact.count({ where: { supervisorId: params.id } })) > 0
          ) {
            throw new TeamHierarchyError(
              'Reatribua os líderes antes de alterar o cargo deste supervisor.',
            );
          }
        }
        if (role && UNIQUE_ROLES.includes(role)) {
          const existing = await tx.internalContact.findFirst({
            where: {
              role,
              id: { not: params.id },
            },
          });
          if (existing) {
            throw new Error(
              `UNIQUE_ROLE:O cargo de '${data.role}' já está ocupado por ${existing.name}.`,
            );
          }
        }

        return tx.internalContact.update({
          where: { id: params.id },
          data: {
            name: ApiUtils.capitalizeName(data.name),
            role: role === '' ? null : role,
            supervisorId:
              role !== undefined && role !== TECHNICAL_LEADER_ROLE
                ? null
                : result.auth.scope === 'all' && data.supervisorId !== undefined
                  ? data.supervisorId || null
                  : undefined,
            phone: data.phone || null,
            email: data.email || null,
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return ApiUtils.success(contact);
  } catch (error: unknown) {
    if (error instanceof TeamHierarchyError) return ApiUtils.error(error.message, null, 400);
    const msg = error instanceof Error ? error.message : '';
    if (msg.startsWith('UNIQUE_ROLE:')) {
      return ApiUtils.error(msg.replace('UNIQUE_ROLE:', ''), null, 400);
    }
    return ApiUtils.error('Erro ao atualizar contato', error);
  }
}

export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  if (result.auth.scope === 'filtered') {
    return ApiUtils.error('Apenas o coordenador pode alterar a equipe interna', null, 403);
  }

  try {
    if (!params.id || !/^c[a-z0-9]{24}$/.test(params.id)) {
      return ApiUtils.error('ID inválido', null, 400);
    }
    await prisma.internalContact.delete({
      where: { id: params.id },
    });
    return ApiUtils.success({ success: true });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao excluir contato', error);
  }
}
