'use client';

import { useCallback, useState } from 'react';

import { Modal } from '@/components/ui/modal';
import type { Appointment, Professional } from '@/types';

interface ScheduleReport {
  href: string;
  label: string;
}

interface ScheduleControlsProps {
  professionals: Professional[];
  professionalId: string;
  setProfessionalId: (id: string) => void;
  loading: boolean;
  loadingPreview?: boolean;
  appointments: Appointment[];
  onGenerate: () => void;
  onClear: () => void;
  reports: ScheduleReport[];
  reportsOpen: boolean;
  setReportsOpen: (open: boolean) => void;
}

export default function ScheduleControls({
  professionals,
  professionalId,
  setProfessionalId,
  loading,
  loadingPreview = false,
  appointments,
  onGenerate,
  onClear,
  reports,
  reportsOpen,
  setReportsOpen,
}: ScheduleControlsProps) {
  const [blockedReports, setBlockedReports] = useState<ScheduleReport[] | null>(null);
  const visibleReports = blockedReports ?? reports;

  const closeReports = useCallback(() => {
    setBlockedReports(null);
    setReportsOpen(false);
  }, [setReportsOpen]);

  const openReports = (reportsToOpen: ScheduleReport[]) => {
    const blocked = reportsToOpen.filter(({ href }) => {
      const tab = window.open(href, '_blank');
      if (!tab) return true;
      tab.opener = null;
      return false;
    });
    if (blocked.length === 0) {
      closeReports();
    } else {
      setBlockedReports(blocked);
      setReportsOpen(true);
    }
  };

  const generateDisabled = loading || loadingPreview || !professionalId;
  const generateLabel = loadingPreview
    ? '⌛ Carregando prévia...'
    : loading
      ? '⌛ Processando...'
      : appointments.length > 0
        ? '🔄 Re-gerar'
        : '📅 Gerar Agenda';
  return (
    <div
      className="glass-panel schedule-controls"
      style={{ marginBottom: '2.5rem', padding: '2rem' }}
    >
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
            disabled={generateDisabled}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.8rem',
              height: '54px',
            }}
          >
            {generateLabel}
          </button>
          <button
            onClick={() => {
              if (reports.length > 1) setReportsOpen(true);
              else openReports(reports);
            }}
            className="btn-secondary"
            disabled={generateDisabled || reports.length === 0}
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
            🖨️ {reports.length} PDF{reports.length !== 1 ? 's' : ''}
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
      <Modal
        isOpen={reportsOpen && visibleReports.length > 0}
        onClose={closeReports}
        title={blockedReports ? 'Relatórios bloqueados' : 'Relatórios da agenda'}
        footer={
          <button className="btn-primary" onClick={() => openReports(visibleReports)}>
            {blockedReports ? 'Tentar abrir novamente' : 'Abrir todos'}
          </button>
        }
      >
        <p>
          {blockedReports
            ? 'Permita pop-ups para este site na barra de endereços ou abra os PDFs pelos links abaixo.'
            : 'Abra todos os PDFs em novas abas ou escolha um relatório da lista.'}
        </p>
        <ul style={{ paddingInlineStart: '1.25rem', marginTop: '1rem' }}>
          {visibleReports.map(({ href, label }) => (
            <li key={href} style={{ marginBottom: '0.5rem' }}>
              <a href={href} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
