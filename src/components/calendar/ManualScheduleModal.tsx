'use client';

import { createPortal } from 'react-dom';

import type { Client } from '@/types';

interface ManualScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  manualDate: string | null;
  manualClientId: string;
  setManualClientId: (id: string) => void;
  manualType: string;
  setManualType: (type: string) => void;
  clients: Client[];
  professionalId: string;
}

export default function ManualScheduleModal({
  isOpen,
  onClose,
  onSave,
  manualDate,
  manualClientId,
  setManualClientId,
  manualType,
  setManualType,
  clients,
  professionalId,
}: ManualScheduleModalProps) {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.95)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: 'blur(10px)',
      }}
      role="presentation"
    >
      <div
        className="glass-panel animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-modal-title"
        style={{
          width: '100%',
          maxWidth: '450px',
          padding: '2.5rem',
          border: '1px solid var(--primary)',
        }}
      >
        <h3
          id="manual-modal-title"
          style={{
            marginBottom: '0.8rem',
            fontSize: '1.5rem',
            fontWeight: '800',
          }}
        >
          Novo Agendamento Individual
        </h3>
        <p
          style={{
            color: 'var(--text-muted)',
            fontSize: '0.9rem',
            marginBottom: '2rem',
          }}
        >
          Data Alvo:{' '}
          <strong style={{ fontWeight: '700' }}>
            {manualDate?.split('-').reverse().join('/')}
          </strong>
        </p>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
          }}
        >
          <div>
            <label
              htmlFor="manual-client"
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Prédio / Cliente
            </label>
            <select
              id="manual-client"
              value={manualClientId}
              onChange={(e) => setManualClientId(e.target.value)}
              style={{
                width: '100%',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'var(--input-bg)',
                color: 'var(--foreground)',
                marginTop: '0.5rem',
                transition: 'var(--transition-fast)',
              }}
            >
              {(professionalId
                ? clients.filter((c) =>
                    c.contracts?.some((ct) => ct.professionalId === professionalId),
                  )
                : clients
              ).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              Natureza do Serviço
            </label>
            <div
              style={{
                display: 'flex',
                gap: '10px',
                marginTop: '0.5rem',
              }}
            >
              <button
                onClick={() => setManualType('VISITA_TECNICA')}
                aria-pressed={manualType === 'VISITA_TECNICA'}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background:
                    manualType === 'VISITA_TECNICA' ? 'var(--primary)' : 'var(--input-bg)',
                  color: manualType === 'VISITA_TECNICA' ? '#000' : 'var(--foreground)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
              >
                Visita Técnica
              </button>
              <button
                onClick={() => setManualType('TESTE_SDAI')}
                aria-pressed={manualType === 'TESTE_SDAI'}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: manualType === 'TESTE_SDAI' ? 'var(--primary)' : 'var(--input-bg)',
                  color: manualType === 'TESTE_SDAI' ? '#000' : 'var(--foreground)',
                  fontWeight: '700',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                }}
              >
                Teste SDAI
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={onSave} className="btn-primary" style={{ flex: 1 }}>
              Agendar Confirmado
            </button>
            <button onClick={onClose} className="btn-secondary" style={{ flex: 1 }}>
              Sair
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
