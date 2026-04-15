'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/modal';
import { statsApi } from '@/lib/api-client';

interface ContractDetail {
  id: string;
  clientName: string;
  professionalName: string | null;
  systemTypes: string | null;
  hasSchedule: boolean;
}

interface Stats {
  clients: number;
  professionals: number;
  totalContracts: number;
  contractsWithSchedule: number;
  contractsDetail: ContractDetail[];
}

function StatBadge({
  value,
  label,
  loading,
}: {
  value: number | null;
  label: string;
  loading?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0.8rem 1.2rem',
        background: 'var(--primary-subtle)',
        borderRadius: '10px',
        border: '1px solid var(--primary-border-subtle)',
        minWidth: '80px',
        animation: loading ? 'statPulse 1.4s ease-in-out infinite' : undefined,
      }}
    >
      <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>
        {loading ? (
          <span
            style={{
              display: 'inline-block',
              width: '2ch',
              height: '1em',
              borderRadius: '4px',
              background: 'var(--primary-border-subtle)',
              verticalAlign: 'middle',
            }}
          />
        ) : (
          value
        )}
      </span>
      <span
        style={{
          fontSize: '0.7rem',
          color: 'var(--text-muted)',
          marginTop: '4px',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </span>
      <style>{`
        @keyframes statPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [showContracts, setShowContracts] = useState(false);

  useEffect(() => {
    statsApi.get().then(({ data }) => {
      if (data) setStats(data);
    });
  }, []);

  return (
    <main
      style={{ padding: '6rem 4rem', maxWidth: '1400px', margin: '0 auto' }}
      className="home-main"
    >
      <header className="animate-fade-in" style={{ marginBottom: '4rem' }}>
        <h1 className="title">Sistema Gestor de Manutenção</h1>
        <p className="subtitle" style={{ maxWidth: '600px', marginBottom: '2rem' }}>
          Gerencie técnicos, visualize contratos e otimize o cronograma de visitas de forma
          automatizada.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <StatBadge value={stats?.clients ?? null} label="Clientes" loading={stats === null} />
          <StatBadge
            value={stats?.professionals ?? null}
            label="Técnicos"
            loading={stats === null}
          />
          <div onClick={() => stats && setShowContracts(true)} style={{ cursor: stats ? 'pointer' : 'default' }}>
            <StatBadge
              value={stats?.contractsWithSchedule ?? null}
              label={`Agendas geradas${stats ? ` de ${stats.totalContracts}` : ''}`}
              loading={stats === null}
            />
          </div>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(350px, 100%), 1fr))',
          gap: '2.5rem',
        }}
      >
        <section
          className="glass-panel animate-fade-in"
          style={{ animationDelay: '0.1s', position: 'relative', overflow: 'hidden' }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              fontSize: '12rem',
              opacity: 0.03,
              fontWeight: 900,
              color: 'var(--primary)',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            01
          </div>
          <h2
            style={{
              fontSize: '1.6rem',
              marginBottom: '1.2rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.8rem',
            }}
          >
            <span style={{ fontSize: '2rem' }}>📋</span> Gestão de Ativos
          </h2>
          <p
            style={{
              color: 'var(--text-muted)',
              marginBottom: '2rem',
              lineHeight: '1.7',
              fontSize: '1rem',
            }}
          >
            Controle centralizado de <strong>Técnicos</strong> e <strong>Clientes</strong>.
            Configure frequências de visita, sistemas (SDAI, CFTV) e preferências de agenda.
          </p>
          <div style={{ display: 'flex', gap: '1.2rem' }}>
            <Link
              href="/clients"
              className="btn-primary"
              style={{
                textDecoration: 'none',
                textAlign: 'center',
                flex: 1,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Contratos
            </Link>
            <Link
              href="/professionals"
              className="btn-secondary"
              style={{
                textDecoration: 'none',
                textAlign: 'center',
                flex: 1,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Técnicos
            </Link>
          </div>
        </section>

        <section
          className="glass-panel animate-fade-in"
          style={{ animationDelay: '0.2s', position: 'relative', overflow: 'hidden' }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-20px',
              right: '-20px',
              fontSize: '12rem',
              opacity: 0.03,
              fontWeight: 900,
              color: 'var(--primary)',
              userSelect: 'none',
              pointerEvents: 'none',
            }}
          >
            02
          </div>
          <h2
            style={{
              fontSize: '1.6rem',
              marginBottom: '1.2rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.8rem',
            }}
          >
            <span style={{ fontSize: '2rem' }}>📅</span> Cronograma Anual
          </h2>
          <p
            style={{
              color: 'var(--text-muted)',
              marginBottom: '2rem',
              lineHeight: '1.7',
              fontSize: '1rem',
            }}
          >
            Visualização estratégica da agenda. Gere visitas automáticas, valide conflitos e agende
            testes trimestrais obrigatórios com precisão cirúrgica.
          </p>
          <Link
            href="/calendar"
            className="btn-primary"
            style={{
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              width: '100%',
              border: 'none',
            }}
          >
            Visualizar Calendário Completo
          </Link>
        </section>
      </div>

      <Modal isOpen={showContracts} onClose={() => setShowContracts(false)} title="Técnicos sem agenda" maxWidth="400px">
        {stats?.contractsDetail && (() => {
          const pending = stats.contractsDetail.filter((c) => !c.hasSchedule);
          const techNames = Array.from(new Set(pending.map((c) => c.professionalName ?? 'Sem técnico'))).sort();
          if (techNames.length === 0) {
            return <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>Todos os técnicos possuem agenda gerada.</p>;
          }
          return (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {techNames.map((name) => (
                <li
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '0.7rem 1rem',
                    borderRadius: '10px',
                    background: 'rgba(251, 146, 60, 0.08)',
                    border: '1px solid rgba(251, 146, 60, 0.2)',
                  }}
                >
                  <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>⚠️</span>
                  <strong style={{ fontSize: '0.9rem', color: 'var(--foreground)' }}>{name}</strong>
                </li>
              ))}
            </ul>
          );
        })()}
      </Modal>

      <footer
        style={{
          marginTop: '6rem',
          paddingTop: '2rem',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          color: 'var(--text-muted)',
          fontSize: '0.85rem',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <p>
          © {new Date().getFullYear()} CompaSSS — Companhia de Parceria em Soluções e Serviços em
          Sistemas
        </p>
      </footer>
    </main>
  );
}
