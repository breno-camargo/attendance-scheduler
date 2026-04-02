'use client';

import type { Appointment, Client } from '@/types';

interface ItineraryPanelProps {
  appointments: Appointment[];
  filterContractId: string | null;
  setFilterContractId: (id: string | null) => void;
  linkedClients: Client[];
  onDayClick: (dateStr: string) => void;
}

export default function ItineraryPanel({
  appointments,
  filterContractId,
  setFilterContractId,
  linkedClients,
  onDayClick,
}: ItineraryPanelProps) {
  const filtered = appointments.filter(
    (a) => !filterContractId || a.contractId === filterContractId,
  );

  return (
    <section
      className="glass-panel"
      style={{
        flex: '1',
        minWidth: '350px',
        position: 'sticky',
        top: '100px',
        height: 'calc(100vh - 140px)',
        overflowY: 'auto',
        borderLeft: '4px solid var(--primary)',
        padding: '2rem',
      }}
    >
      <h2
        style={{
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.8rem',
          fontSize: '1.4rem',
        }}
      >
        <span style={{ fontSize: '1.8rem' }}>🔧</span> Itinerário Diário
      </h2>

      <div style={{ marginBottom: '2.5rem' }}>
        <label
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            fontWeight: 'bold',
            letterSpacing: '1px',
          }}
        >
          Filtro Rápido por Ativo:
        </label>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginTop: '1rem',
          }}
        >
          <button
            onClick={() => setFilterContractId(null)}
            style={{
              padding: '8px 16px',
              borderRadius: '30px',
              border: '1px solid var(--border)',
              background: filterContractId === null ? 'var(--primary)' : 'rgba(255,255,255,0.02)',
              color: filterContractId === null ? '#000' : 'var(--text-muted)',
              fontSize: '0.8rem',
              fontWeight: '800',
              cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
          >
            VISÃO GERAL
          </button>
          {linkedClients.map((c) => (
            <button
              key={c.id}
              onClick={() => setFilterContractId(c.contracts?.[0]?.id ?? null)}
              style={{
                padding: '8px 16px',
                borderRadius: '30px',
                border: '1px solid var(--border)',
                background:
                  filterContractId === c.contracts?.[0]?.id
                    ? 'var(--primary)'
                    : 'rgba(255,255,255,0.02)',
                color: filterContractId === c.contracts?.[0]?.id ? '#000' : 'var(--text-muted)',
                fontSize: '0.8rem',
                fontWeight: '800',
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
              }}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 0',
            color: 'var(--text-muted)',
          }}
        >
          <p style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</p>
          <p>
            Nenhum atendimento
            <br />
            programado para este filtro.
          </p>
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {filtered.map((a, i) => {
            const accentColor = a.type === 'TESTE_SDAI' ? 'var(--cal-test)' : 'var(--primary)';
            return (
              <li
                key={a.id}
                className="animate-fade-in"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.2rem',
                  padding: '1.2rem',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid transparent',
                  transition: 'var(--transition-smooth)',
                  animationDelay: `${i * 0.03}s`,
                  cursor: 'pointer',
                }}
                onClick={() => onDayClick(new Date(a.date).toISOString().split('T')[0])}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.05)';
                  e.currentTarget.style.borderColor = 'var(--border)';
                  e.currentTarget.style.transform = 'translateX(8px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                  e.currentTarget.style.borderColor = 'transparent';
                  e.currentTarget.style.transform = 'translateX(0)';
                }}
              >
                <div
                  style={{
                    textAlign: 'center',
                    minWidth: '60px',
                    borderRight: '1px solid var(--border)',
                    paddingRight: '1.2rem',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      display: 'block',
                    }}
                  >
                    {new Date(a.date)
                      .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' })
                      .replace('.', '')}
                  </span>
                  <span
                    style={{
                      fontSize: '1.4rem',
                      fontWeight: '800',
                      color: accentColor,
                    }}
                  >
                    {new Date(a.date).toLocaleDateString('pt-BR', {
                      day: 'numeric',
                      timeZone: 'UTC',
                    })}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <strong
                    style={{
                      fontSize: '1.1rem',
                      display: 'block',
                      color: 'white',
                    }}
                  >
                    {a.client?.name}
                  </strong>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '4px',
                    }}
                  >
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: accentColor,
                      }}
                    ></span>
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        fontSize: '0.85rem',
                      }}
                    >
                      {a.type === 'TESTE_SDAI' ? 'Teste Geral SDAI' : a.observation}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
