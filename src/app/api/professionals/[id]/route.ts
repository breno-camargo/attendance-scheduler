import { ApiUtils, getScopedProfessionalIds, requireAuthWithScope } from '@/lib/api-utils';
import { writeAuditLog } from '@/lib/audit-log';
import prisma from '@/lib/prisma';
import { professionalSchema } from '@/lib/schemas';

/**
 * GET /api/professionals/[id]
 * Retorna dados completos (sem máscara) de um técnico — usado nos formulários de edição.
 */
export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth } = result;

  const { id } = params;
  if (!id || !/^c[a-z0-9]{24}$/.test(id)) {
    return ApiUtils.error('ID inválido', null, 400);
  }

  const profIds = await getScopedProfessionalIds(auth);
  if (profIds && !profIds.includes(id)) {
    return ApiUtils.error('Sem permissão', null, 403);
  }

  const prof = await prisma.professional.findUnique({
    where: { id },
    include: { supervisor: { select: { id: true, name: true, role: true } } },
  });

  if (!prof) return ApiUtils.error('Técnico não encontrado', null, 404);
  return ApiUtils.success(prof);
}

/**
 * PUT /api/professionals/[id]
 * Atualiza os dados de um técnico existente.
 */
export async function PUT(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    if (
      auth.scope === 'filtered' &&
      body.supervisorId !== undefined &&
      body.supervisorId !== auth.internalContactId
    ) {
      return ApiUtils.error('VocÃª nÃ£o tem permissÃ£o para reatribuir este tÃ©cnico', null, 403);
    }

    const email = data.email.includes('@')
      ? data.email
      : `${data.email}@${process.env.EMAIL_DOMAIN || 'compasss.com.br'}`;

    const updated = await prisma.professional.update({
      where: { id },
      data: {
        name: ApiUtils.capitalizeName(data.name),
        email,
        phone: data.phone || null,
        supervisorId: body.supervisorId !== undefined ? body.supervisorId || null : undefined,
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
export async function DELETE(_request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth, session } = result;

  try {
    const { id } = params;
    if (!id || !/^c[a-z0-9]{24}$/.test(id)) {
      return ApiUtils.error('ID inválido', null, 400);
    }

    const profIds = await getScopedProfessionalIds(auth);
    if (profIds && !profIds.includes(id)) {
      return ApiUtils.error('Você não tem permissão para excluir este técnico', null, 403);
    }

    const existing = await prisma.professional.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) {
      return ApiUtils.error('Técnico não encontrado', null, 404);
    }

    const [, detachedContracts, detachedAppointments] = await prisma.$transaction([
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

    await writeAuditLog({
      session,
      action: 'PROFESSIONAL_DELETED',
      entityType: 'PROFESSIONAL',
      entityId: existing.id,
      entityLabel: existing.name,
      metadata: {
        detachedContractCount: detachedContracts.count,
        detachedAppointmentCount: detachedAppointments.count,
      },
    });

    return ApiUtils.success({ success: true });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao excluir técnico', error);
  }
}
