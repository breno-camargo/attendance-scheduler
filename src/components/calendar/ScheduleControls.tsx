'use client';

import type { Appointment, Professional } from '@/types';

interface ScheduleControlsProps {
  professionals: Professional[];
  professionalId: string;
  setProfessionalId: (id: string) => void;
  loading: boolean;
  appointments: Appointment[];
  onGenerate: () => void;
  onClear: () => void;
}

export default function ScheduleControls({
  professionals,
  professionalId,
  setProfessionalId,
  loading,
  appointments,
  onGenerate,
  onClear,
}: ScheduleControlsProps) {
  return (
    <div className="glass-panel" style={{ marginBottom: '2.5rem', padding: '2rem' }}>
      <div
        style={{
          display: 'flex',
          gap: '2rem',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            flex: '1',
            minWidth: '250px',
          }}
        >
          <label
            htmlFor="cal-professional"
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              fontWeight: 'bold',
            }}
          >
            Selecione o Técnico Responsável:
          </label>
          <select
            id="cal-professional"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            style={{
              width: '100%',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              background: 'rgba(0,0,0,0.4)',
              color: 'white',
              transition: 'var(--transition-fast)',
              fontSize: '1rem',
              fontWeight: '600',
            }}
          >
            {professionals.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
            {professionals.length === 0 && <option value="">Nenhum técnico disponível</option>}
          </select>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            flex: '1',
            minWidth: 'min(350px, 100%)',
          }}
        >
          <button
            onClick={onGenerate}
            className="btn-primary"
            disabled={loading || !professionalId}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.8rem',
              height: '54px',
            }}
          >
            {loading
              ? '⌛ Agendando...'
              : appointments.length > 0
                ? '🔄 Re-gerar Agenda'
                : '📅 Gerar Agenda'}
          </button>
          <button
            onClick={onClear}
            className="btn-secondary"
            disabled={loading || !professionalId || appointments.length === 0}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              flex: '0.6',
              height: '54px',
            }}
          >
            🗑️ Limpar
          </button>
        </div>
      </div>
    </div>
  );
}
