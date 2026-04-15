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
  contractIds: string[];
}

export default function ScheduleControls({
  professionals,
  professionalId,
  setProfessionalId,
  loading,
  appointments,
  onGenerate,
  onClear,
  contractIds,
}: ScheduleControlsProps) {
  return (
    <div className="glass-panel schedule-controls" style={{ marginBottom: '2.5rem', padding: '2rem' }}>
      <div className="schedule-controls-row">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.6rem',
            flex: '1',
            minWidth: '200px',
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
            className="form-input"
            value={professionalId}
            onChange={(e) => setProfessionalId(e.target.value)}
            style={{
              width: '100%',
              padding: '1rem',
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

        <div className="schedule-controls-buttons">
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
                ? '🔄 Re-gerar'
                : '📅 Gerar Agenda'}
          </button>
          <button
            onClick={() => {
              contractIds.forEach((id) => {
                const a = document.createElement('a');
                a.href = `/reports/contract/${id}`;
                a.target = '_blank';
                a.rel = 'noopener';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
              });
            }}
            className="btn-secondary"
            disabled={contractIds.length === 0}
            style={{
              background: 'rgba(16, 185, 129, 0.08)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              height: '54px',
              padding: '0 1.2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            🖨️ {contractIds.length} PDF{contractIds.length !== 1 ? 's' : ''}
          </button>
          <button
            onClick={onClear}
            className="btn-secondary"
            disabled={loading || !professionalId || appointments.length === 0}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              height: '54px',
              flex: 1,
            }}
          >
            🗑️ Limpar
          </button>
        </div>
      </div>
    </div>
  );
}
