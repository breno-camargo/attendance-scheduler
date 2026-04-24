import type { Session } from 'next-auth';

import prisma from './prisma';

export type AuditAction =
  | 'CLIENT_DELETED'
  | 'PROFESSIONAL_DELETED'
  | 'APPOINTMENT_DELETED'
  | 'SCHEDULE_CLEARED';

export type AuditEntityType = 'CLIENT' | 'PROFESSIONAL' | 'APPOINTMENT' | 'SCHEDULE';

interface WriteAuditLogInput {
  session: Session;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  metadata?: Record<string, unknown> | null;
}

function getActor(session: Session): { userId: string | null; actorLabel: string } {
  const user = session.user as
    | { id?: string | null; name?: string | null; email?: string | null }
    | undefined;
  return {
    userId: user?.id ?? null,
    actorLabel: user?.name || user?.email || user?.id || 'unknown',
  };
}

export async function writeAuditLog({
  session,
  action,
  entityType,
  entityId,
  entityLabel,
  metadata,
}: WriteAuditLogInput) {
  try {
    const { userId, actorLabel } = getActor(session);
    await prisma.auditLog.create({
      data: {
        userId,
        actorLabel,
        action,
        entityType,
        entityId: entityId ?? null,
        entityLabel: entityLabel ?? null,
        metadataJson: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (error) {
    console.error('[AuditLog] falha ao persistir log:', error);
  }
}
