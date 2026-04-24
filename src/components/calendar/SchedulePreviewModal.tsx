'use client';

import { createPortal } from 'react-dom';

import type { SchedulePreviewData } from '@/types';

interface SchedulePreviewModalProps {
  isOpen: boolean;
  preview: SchedulePreviewData | null;
  year: number;
  existingYear: number | null;
  // true se o técnico já tem qualquer atendimento hoje (de qualquer ano ou manual
  // adicionado agora); guia o aviso destrutivo porque /generate apaga tudo do técnico.
  hasExistingSchedule: boolean;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const metricCardStyle: React.CSSProperties = {
  flex: 1,
  minWidth: '120px',
  padding: '1rem',
  borderRadius: '8px',
  background: 'var(--input-bg)',
  border: '1px solid var(--border)',
  textAlign: 'center',
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '1px',
  marginBottom: '0.25rem',
};

const metricValueStyle: React.CSSProperties = {
  fontSize: '1.6rem',
  fontWeight: 800,
  color: 'var(--foreground)',
};

export default function SchedulePreviewModal({
  isOpen,
  preview,
  year,
  existingYear,
  hasExistingSchedule,
  loading,
  onConfirm,
  onClose,
}: SchedulePreviewModalProps) {
  if (!isOpen || typeof document === 'undefined' || !preview) return null;

  const destructiveWarning = !hasExistingSchedule
    ? 'Nenhuma agenda anterior será afetada.'
    : existingYear !== null
      ? `Este técnico já possui agenda (último ano detectado: ${existingYear}). Gerar vai substituir toda a agenda existente dele.`
      : 'Este técnico possui atendimentos cadastrados que serão removidos. Gerar vai substituir todos os atendimentos existentes.';

  const isDestructive = hasExistingSchedule;

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
        padding: '1rem',
      }}
      role="presentation"
    >
      <div
        className="glass-panel animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-modal-title"
        style={{
          width: '100%',
          maxWidth: '640px',
          padding: '2.5rem',
          border: '1px solid var(--primary)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        <h3
          id="preview-modal-title"
          style={{ marginBottom: '0.4rem', fontSize: '1.5rem', fontWeight: 800 }}
        >
          Prévia da agenda {year}
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Revise o impacto antes de confirmar. Nada é gravado até você clicar em confirmar.
        </p>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div style={metricCardStyle}>
            <div style={metricLabelStyle}>Total</div>
            <div style={metricValueStyle}>{preview.count}</div>
          </div>
          <div style={metricCardStyle}>
            <div style={metricLabelStyle}>Contratos</div>
            <div style={metricValueStyle}>{preview.contractCount}</div>
          </div>
          <div style={metricCardStyle}>
            <div style={metricLabelStyle}>Visitas</div>
            <div style={metricValueStyle}>{preview.byType.VISITA_TECNICA}</div>
          </div>
          <div style={metricCardStyle}>
            <div style={metricLabelStyle}>Testes SDAI</div>
            <div style={metricValueStyle}>{preview.byType.TESTE_SDAI}</div>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '0.5rem',
            }}
          >
            Distribuição por mês
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '0.5rem',
            }}
          >
            {MONTH_LABELS.map((label, month) => {
              const counts = preview.byMonth[month] ?? { VISITA_TECNICA: 0, TESTE_SDAI: 0 };
              const total = counts.VISITA_TECNICA + counts.TESTE_SDAI;
              return (
                <div
                  key={month}
                  style={{
                    padding: '0.5rem',
                    borderRadius: '6px',
                    background: total > 0 ? 'var(--input-bg)' : 'transparent',
                    border: '1px solid var(--border)',
                    textAlign: 'center',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--foreground)' }}>{label}</div>
                  <div style={{ color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {counts.VISITA_TECNICA}v / {counts.TESTE_SDAI}s
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            padding: '0.9rem 1rem',
            borderRadius: '8px',
            background: isDestructive ? 'rgba(234, 88, 12, 0.12)' : 'rgba(34, 197, 94, 0.12)',
            border: `1px solid ${isDestructive ? '#ea580c' : '#22c55e'}`,
            marginBottom: '1.5rem',
            fontSize: '0.9rem',
            lineHeight: 1.4,
          }}
        >
          {destructiveWarning}
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={onConfirm}
            className="btn-primary"
            style={{ flex: 1 }}
            disabled={loading}
          >
            {loading ? 'Gerando...' : 'Confirmar geração'}
          </button>
          <button
            onClick={onClose}
            className="btn-secondary"
            style={{ flex: 1 }}
            disabled={loading}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
