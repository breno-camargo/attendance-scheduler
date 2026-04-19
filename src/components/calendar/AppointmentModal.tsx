'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

import type { Appointment } from '@/types';

interface AppointmentModalProps {
  appointment: Appointment;
  newDate: string;
  setNewDate: (date: string) => void;
  onToggleType: () => void;
  onUpdateDate: () => Promise<string | null>;
  onDelete: () => void;
  onClose: () => void;
}

export default function AppointmentModal({
  appointment,
  newDate,
  setNewDate,
  onToggleType,
  onUpdateDate,
  onDelete,
  onClose,
}: AppointmentModalProps) {
  const [error, setError] = useState<string | null>(null);
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(8px)',
      }}
      role="presentation"
    >
      <div
        className="glass-panel animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="apt-modal-title"
        style={{
          padding: '2.5rem',
          maxWidth: '400px',
          width: '90%',
          border: '1px solid var(--primary)',
        }}
      >
        <h2 id="apt-modal-title" style={{ marginBottom: '1rem', fontSize: '1.6rem' }}>
          Gerenciar Visita
        </h2>
        <p
          style={{
            marginBottom: '2rem',
            color: 'var(--text-muted)',
            lineHeight: '1.6',
          }}
        >
          <strong style={{ color: 'var(--primary)', fontSize: '1.2rem' }}>
            {appointment.client?.name}
          </strong>
          <br />
          <span style={{ fontSize: '0.9rem' }}>
            📅 Data Alocada:{' '}
            {new Date(appointment.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
          </span>
        </p>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
          }}
        >
          <button
            onClick={onToggleType}
            className="btn-secondary"
            style={{
              background: 'var(--input-bg)',
              color: 'var(--foreground)',
              border: '1px solid var(--border)',
              width: '100%',
            }}
          >
            🔄 Mudar para {appointment.type === 'VISITA_TECNICA' ? 'Teste SDAI' : 'Visita Comum'}
          </button>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.8rem',
              marginTop: '0.5rem',
              border: '1px solid var(--border)',
              padding: '1.2rem',
              borderRadius: '12px',
              background: 'var(--input-bg)',
            }}
          >
            <label
              htmlFor="reschedule-date"
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                fontWeight: 'bold',
              }}
            >
              Re-agendar para:
            </label>
            <input
              id="reschedule-date"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              style={{
                width: '100%',
                padding: '0.8rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--input-bg)',
                color: 'var(--foreground)',
                transition: 'var(--transition-fast)',
              }}
            />
            <button
              onClick={async () => {
                setError(null);
                const err = await onUpdateDate();
                if (err) setError(err);
              }}
              className="btn-primary"
              style={{
                fontSize: '0.85rem',
                padding: '0.8rem',
                width: '100%',
              }}
              disabled={!newDate}
            >
              🚀 Mover Visita
            </button>
            {error && (
              <p
                style={{
                  margin: 0,
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#ef4444',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                {error}
              </p>
            )}
          </div>

          <button
            onClick={onDelete}
            className="btn-secondary"
            style={{
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              border: '1px solid var(--danger-border)',
              marginTop: '0.5rem',
            }}
          >
            🗑️ Excluir Visita
          </button>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ marginTop: '0.5rem', width: '100%' }}
          >
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
