import { ApiUtils, requireAuthWithScope, requireProfessionalInScope } from '@/lib/api-utils';
import { writeAuditLog } from '@/lib/audit-log';
import { getHolidaysForYear } from '@/lib/holidays';
import prisma from '@/lib/prisma';
import { renumberContractVisits } from '@/lib/schedule-service';
import { appointmentPatchSchema } from '@/lib/schemas';

/**
 * DELETE /api/schedule/[id]
 * Remove um agendamento específico.
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
    const existing = await prisma.appointment.findUnique({
      where: { id },
      include: { client: { select: { name: true } } },
    });
    if (!existing) {
      return ApiUtils.error('Agendamento não encontrado', null, 404);
    }
    const scopeError = await requireProfessionalInScope(auth, existing.professionalId);
    if (scopeError) return scopeError;

    await prisma.appointment.delete({ where: { id } });
    await writeAuditLog({
      session,
      action: 'APPOINTMENT_DELETED',
      entityType: 'APPOINTMENT',
      entityId: existing.id,
      entityLabel: existing.client?.name ?? existing.date.toISOString(),
      metadata: {
        clientId: existing.clientId,
        professionalId: existing.professionalId,
        contractId: existing.contractId,
        date: existing.date.toISOString(),
        type: existing.type,
      },
    });

    // Renumera visitas restantes do contrato no mesmo ano — senão a observation
    // grava stale (ex: deletar Jan-Abr deixa "Visita 05" como primeira em Maio no PDF).
    if (existing.contractId && existing.type === 'VISITA_TECNICA') {
      await renumberContractVisits(existing.contractId, existing.date.getUTCFullYear());
    }
    return ApiUtils.success({ success: true });
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao excluir agendamento', error);
  }
}

/**
 * PATCH /api/schedule/[id]
 * Atualiza parcialmente um agendamento (tipo, observação ou data).
 */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await requireAuthWithScope();
  if ('error' in result) return result.error;
  const { auth, session } = result;

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

    // Snapshot pre-update pra detectar mudanças e montar o audit log.
    const existing = await prisma.appointment.findUnique({
      where: { id },
      include: { client: { select: { name: true } } },
    });
    if (!existing) {
      return ApiUtils.error('Agendamento não encontrado', null, 404);
    }

    const scopeError = await requireProfessionalInScope(auth, existing.professionalId);
    if (scopeError) return scopeError;

    // Quando troca o tipo sem mandar observation custom, reescreve sozinho:
    // VISITA→SDAI vira "Teste Geral SDAI (Trimestral)" (padrão da geração).
    // SDAI→VISITA vira string vazia agora e a renumeração logo abaixo escreve
    // "Visita NN" na posição cronológica correta. Sem isso, a observation antiga
    // fica stale (ex: "Visita 58" num appointment que virou teste).
    let computedObservation = observation;
    const typeChanging = type !== undefined && type !== existing.type;
    if (typeChanging && observation === undefined) {
      computedObservation = type === 'TESTE_SDAI' ? 'Teste Geral SDAI (Trimestral)' : '';
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        ...(type !== undefined && { type }),
        ...(computedObservation !== undefined && { observation: computedObservation }),
        ...(date !== undefined && { date: new Date(date) }),
      },
    });

    // Comparação usa o updated pré-renumeração (abaixo) — reflete a intenção
    // direta do usuário. Renumeração de visitas é efeito colateral que não
    // deve poluir o audit da visita alvo.
    const dateChanged = existing.date.getTime() !== updated.date.getTime();
    const typeChanged = existing.type !== updated.type;
    const observationChanged = existing.observation !== updated.observation;
    if (dateChanged || typeChanged || observationChanged) {
      await writeAuditLog({
        session,
        action: 'APPOINTMENT_UPDATED',
        entityType: 'APPOINTMENT',
        entityId: existing.id,
        entityLabel: existing.client?.name ?? existing.date.toISOString(),
        metadata: {
          before: {
            date: existing.date.toISOString(),
            type: existing.type,
            observation: existing.observation,
          },
          after: {
            date: updated.date.toISOString(),
            type: updated.type,
            observation: updated.observation,
          },
          clientId: existing.clientId,
          professionalId: existing.professionalId,
          contractId: existing.contractId,
        },
      });
    }

    // Renumera o(s) ano(s) afetado(s) quando:
    //  - Data muda (visita entra/sai de um ano) → renumera novo e antigo se atravessou
    //  - Tipo muda (VISITA vira SDAI ou vice-versa, o que altera a contagem) → renumera o ano
    // Renumeração é year-scoped pra bater com o filtro do PDF.
    if (updated.contractId && (date || typeChanging)) {
      const oldYear = existing.date.getUTCFullYear();
      const newYear = updated.date.getUTCFullYear();
      const yearsToRenumber = new Set<number>([oldYear, newYear]);
      for (const year of yearsToRenumber) {
        await renumberContractVisits(updated.contractId, year);
      }
    }

    return ApiUtils.success(updated);
  } catch (error: unknown) {
    return ApiUtils.error('Erro ao atualizar agendamento', error);
  }
}
