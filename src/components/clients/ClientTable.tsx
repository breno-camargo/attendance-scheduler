'use client';

import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/ui/glass-card';
import type { Client } from '@/types';

interface ClientTableProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (id: string, name: string) => void;
}

const FREQ_LABELS: Record<string, string> = {
  MONTHLY: 'Mensal',
  BIMONTHLY: 'Bimestral',
  QUARTERLY: 'Trimestral',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

const DAY_NAMES = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'];
const MONTH_NAMES = [
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

// Cores fixas por sistema conhecido
const SYSTEM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  SDAI: { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.35)' },
  CFTV: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.35)' },
  SCA: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', border: 'rgba(168, 85, 247, 0.35)' },
  SAP: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.35)' },
  SAI: { bg: 'rgba(234, 179, 8, 0.15)', text: '#fbbf24', border: 'rgba(234, 179, 8, 0.35)' },
  INTERFONIA: {
    bg: 'rgba(100, 116, 139, 0.15)',
    text: '#94a3b8',
    border: 'rgba(100, 116, 139, 0.35)',
  },
};

// Paleta de fallback para sistemas desconhecidos (cíclica)
const FALLBACK_PALETTE = [
  { bg: 'rgba(180, 83, 9, 0.15)', text: '#d97706', border: 'rgba(180, 83, 9, 0.35)' }, // marrom/âmbar
  { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6', border: 'rgba(236, 72, 153, 0.35)' }, // rosa
  { bg: 'rgba(20, 184, 166, 0.15)', text: '#2dd4bf', border: 'rgba(20, 184, 166, 0.35)' }, // teal
  { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: 'rgba(99, 102, 241, 0.35)' }, // índigo
  { bg: 'rgba(245, 158, 11, 0.15)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.35)' }, // âmbar claro
  { bg: 'rgba(6, 182, 212, 0.15)', text: '#22d3ee', border: 'rgba(6, 182, 212, 0.35)' }, // ciano
];

// Cache estável para cores de sistemas desconhecidos (usa closure para evitar module-level mutável)
const unknownSystemColors = new Map<string, number>();

function getSystemColor(system: string) {
  const key = system.trim().toUpperCase();
  if (SYSTEM_COLORS[key]) return SYSTEM_COLORS[key];

  if (!unknownSystemColors.has(key)) {
    unknownSystemColors.set(key, unknownSystemColors.size % FALLBACK_PALETTE.length);
  }
  return FALLBACK_PALETTE[unknownSystemColors.get(key)!];
}

function SystemBadge({ system }: { system: string }) {
  const { bg, text, border } = getSystemColor(system);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: '100px',
        fontSize: '0.68rem',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        background: bg,
        color: text,
        border: `1px solid ${border}`,
      }}
    >
      {system.trim()}
    </span>
  );
}

export default function ClientTable({ clients, onEdit, onDelete }: ClientTableProps) {
  const [search, setSearch] = useState('');
  const [techFilter, setTechFilter] = useState('');

  // Técnicos únicos vinculados a contratos
  const techs = useMemo(
    () =>
      Array.from(
        new Map(
          clients
            .flatMap((c) => c.contracts || [])
            .filter((ct) => ct.professional)
            .map((ct) => [ct.professional!.id, ct.professional!.name]),
        ).entries(),
      ),
    [clients],
  );

  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase();
    return clients.filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(searchLower);
      const matchesTech =
        !techFilter || c.contracts?.some((ct) => ct.professionalId === techFilter);
      return matchesSearch && matchesTech;
    });
  }, [clients, search, techFilter]);

  const totalContracts = clients.reduce((sum, c) => sum + (c.contracts?.length || 0), 0);
  const filteredContracts = filtered.reduce((sum, c) => sum + (c.contracts?.length || 0), 0);

  return (
    <section className="glass-panel animate-fade-in" style={{ animationDelay: '0.1s' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1rem',
        }}
      >
        <h2 style={{ margin: 0 }}>Contratos Vigentes</h2>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {search || techFilter ? `${filteredContracts} de ${totalContracts}` : totalContracts}{' '}
          contrato
          {totalContracts !== 1 ? 's' : ''}
        </span>
      </div>

      <div
        style={{
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <div style={{ flex: '1 1 200px', position: 'relative' }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{
              width: '100%',
              padding: '0.7rem 1rem 0.7rem 2.4rem',
              borderRadius: '10px',
              border: '1px solid var(--primary-border-subtle)',
              background: 'var(--input-bg)',
              color: 'var(--foreground)',
              fontSize: '0.95rem',
            }}
          />
        </div>
        {techs.length > 1 && (
          <div style={{ flex: '0 1 240px', position: 'relative' }}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <select
              value={techFilter}
              onChange={(e) => setTechFilter(e.target.value)}
              className="form-input"
              style={{
                width: '100%',
                padding: '0.7rem 1rem 0.7rem 2.4rem',
                borderRadius: '10px',
                border: techFilter
                  ? '1px solid var(--primary)'
                  : '1px solid var(--primary-border-subtle)',
                background: techFilter ? 'var(--primary-subtle)' : 'var(--input-bg)',
                color: techFilter ? 'var(--foreground)' : 'var(--text-muted)',
                fontSize: '0.95rem',
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
              }}
            >
              <option value="">Todos os técnicos</option>
              {techs.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        )}
      </div>

      {clients.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
          <p>Nenhum cliente cadastrado ainda.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</div>
          <p>
            Nenhum cliente encontrado para{' '}
            <strong style={{ color: 'var(--foreground)' }}>&quot;{search}&quot;</strong>.
          </p>
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {filtered.map((c, index) => {
            const contract = c.contracts?.[0];
            const freqLabel =
              contract?.frequency === 'MONTHLY'
                ? `${contract?.visitsPerMonth}x / mês`
                : (FREQ_LABELS[contract?.frequency ?? ''] ?? '—');
            const hasSchedule = (contract?._count?.appointments ?? 0) > 0;
            const systems: string[] = contract?.systemTypes ? contract.systemTypes.split(',') : [];
            const pDays = contract?.preferredDays
              ? contract.preferredDays
                  .split(',')
                  .map((d: string) => DAY_NAMES[parseInt(d) - 1])
                  .join(', ')
              : null;
            const targetMonths = contract?.targetMonths
              ? contract.targetMonths
                  .split(',')
                  .map((m: string) => MONTH_NAMES[parseInt(m)])
                  .join(', ')
              : null;

            return (
              <li
                key={c.id}
                style={{
                  animation: `fadeIn 0.5s var(--ease-out-expo) forwards ${index * 0.08}s`,
                  opacity: 0,
                }}
              >
                <GlassCard
                  className="responsive-card"
                  style={{
                    display: 'flex',
                    alignItems: 'stretch',
                    padding: 0,
                    overflow: 'hidden',
                    borderRadius: '14px',
                    flexWrap: 'wrap',
                  }}
                  hoverable={false}
                >
                  {/* Accent bar */}
                  <div
                    style={{
                      width: '4px',
                      flexShrink: 0,
                      background: 'linear-gradient(180deg, var(--primary), var(--accent))',
                      borderRadius: '14px 0 0 14px',
                    }}
                  />

                  {/* Content */}
                  <div style={{ flex: 1, padding: '1.2rem 1.4rem', minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '10px',
                      }}
                    >
                      <strong
                        style={{
                          fontSize: '1.2rem',
                          color: 'var(--primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.name}
                      </strong>
                      {!hasSchedule && (
                        <span
                          style={{
                            fontSize: '0.65rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '6px',
                            background: 'rgba(251, 146, 60, 0.1)',
                            color: '#fb923c',
                            border: '1px solid rgba(251, 146, 60, 0.25)',
                            flexShrink: 0,
                          }}
                        >
                          Sem agenda
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '6px',
                        flexWrap: 'wrap',
                        marginBottom: '10px',
                      }}
                    >
                      <Badge variant="outline">{freqLabel}</Badge>
                      {systems.slice(0, 6).map((sys: string) => (
                        <SystemBadge key={sys} system={sys} />
                      ))}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '1.2rem',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        fontSize: '0.82rem',
                        color: 'var(--text-muted)',
                      }}
                    >
                      <strong style={{ color: 'var(--foreground)', fontSize: '0.9rem' }}>
                        {contract?.professional?.name || 'Não vinculado'}
                      </strong>
                      {contract?.professional?.phone && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ color: 'var(--primary)', flexShrink: 0 }}
                          >
                            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                          </svg>
                          {contract.professional.phone}
                        </span>
                      )}
                      {contract?.professional?.email && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ color: 'var(--primary)', flexShrink: 0 }}
                          >
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                            <polyline points="22,6 12,13 2,6" />
                          </svg>
                          {contract.professional.email}
                        </span>
                      )}
                      {pDays && (
                        <span>
                          📅 Preferência:{' '}
                          <strong style={{ color: 'var(--primary)' }}>{pDays}</strong>
                        </span>
                      )}
                      {targetMonths && (
                        <span>
                          🗓️ Meses:{' '}
                          <strong style={{ color: 'var(--primary)' }}>{targetMonths}</strong>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="client-card-actions"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '1rem',
                      borderLeft: '1px solid var(--primary-border-subtle)',
                      flexShrink: 0,
                    }}
                  >
                    <button onClick={() => onEdit(c)} className="btn-icon btn-icon-orange">
                      <span style={{ fontSize: '1.1rem' }}>✏️</span>Editar
                    </button>
                    <button
                      onClick={() => onDelete(c.id, c.name)}
                      className="btn-icon btn-icon-red"
                    >
                      <span style={{ fontSize: '1.1rem' }}>🗑️</span>Excluir
                    </button>
                  </div>
                </GlassCard>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
