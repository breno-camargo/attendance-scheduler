import type { Prisma } from '@prisma/client';

import { TECHNICAL_LEADER_ROLE } from '@/lib/constants';

export class TeamHierarchyError extends Error {}

export async function validateTeamSupervisor(
  tx: Prisma.TransactionClient,
  role: string,
  supervisorId?: string | null,
  leaderId?: string,
) {
  if (!supervisorId) return;

  if (role !== TECHNICAL_LEADER_ROLE || supervisorId === leaderId) {
    throw new TeamHierarchyError('O vínculo com um supervisor é exclusivo de líderes técnicos.');
  }

  const supervisor = await tx.internalContact.findUnique({
    where: { id: supervisorId },
    select: { role: true },
  });
  if (supervisor?.role !== 'Supervisor') {
    throw new TeamHierarchyError('Selecione um integrante com o cargo de Supervisor.');
  }
}
