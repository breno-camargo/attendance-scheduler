'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';

const SESSION_MAX_AGE = 8 * 60 * 60; // mesma config do auth.ts
const WARNING_BEFORE = 5 * 60; // avisa 5 min antes

export default function SessionTimeout() {
  const { data: session, status } = useSession();
  const [showWarning, setShowWarning] = useState(false);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (status !== 'authenticated' || !session) return;

    const issued = (session as { expires?: string }).expires;
    if (!issued) return;

    const expiresAt = new Date(issued).getTime();

    const interval = setInterval(() => {
      const now = Date.now();
      const left = Math.max(0, Math.floor((expiresAt - now) / 1000));

      if (left <= 0) {
        signOut({ callbackUrl: '/login' });
        return;
      }

      if (left <= WARNING_BEFORE) {
        setShowWarning(true);
        setRemaining(left);
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session, status]);

  if (!showWarning) return null;

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        background: 'var(--bg-card, #1a1a2e)',
        border: '1px solid var(--warning, #f59e0b)',
        borderRadius: '0.75rem',
        padding: '1rem 1.5rem',
        zIndex: 9999,
        maxWidth: '320px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
    >
      <p style={{ margin: '0 0 0.5rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--warning, #f59e0b)' }}>
        Sessão expirando
      </p>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: 'var(--text-muted, #9ca3af)' }}>
        Sua sessão expira em {minutes}:{seconds.toString().padStart(2, '0')}.
        Salve seu trabalho.
      </p>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="btn-secondary"
        style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}
      >
        Sair agora
      </button>
    </div>
  );
}
