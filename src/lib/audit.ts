type AuditEvent =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGIN_RATE_LIMITED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET_COMPLETED'
  | 'DATA_IMPORTED'
  | 'SCHEDULE_GENERATED';

interface AuditEntry {
  event: AuditEvent;
  userId?: string | null;
  ip?: string | null;
  details?: string;
}

/**
 * Loga eventos de segurança no stdout (Vercel captura automaticamente).
 * Formato estruturado pra facilitar busca nos logs.
 */
export function audit({ event, userId, ip, details }: AuditEntry) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    userId: userId || 'anonymous',
    ip: ip || 'unknown',
    ...(details ? { details } : {}),
  };

  // eslint-disable-next-line no-console
  console.log(`[AUDIT] ${JSON.stringify(entry)}`);
}
