'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Modal } from '@/components/ui/modal';
import { statsApi } from '@/lib/api-client';

interface Stats {
  clients: number;
  professionals: number;
  totalContracts: number;
  contractsWithSchedule: number;
  pendingTechs: string[];
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
    <div className={`stat-badge${loading ? ' stat-badge--loading' : ''}`}>
      <span className="stat-badge__value">
        {loading ? <span className="skeleton skeleton-num" aria-hidden="true" /> : value}
      </span>
      <span className="stat-badge__label">{label}</span>
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

  const loading = stats === null;
  const pendingTechs = stats?.pendingTechs ?? [];

  return (
    <div className="home-main">
      <header className="animate-fade-in home-header">
        <h1 className="title">Sistema Gestor de Manutenção</h1>
        <p className="subtitle home-subtitle">
          Gerencie técnicos, visualize contratos e otimize o cronograma de visitas de forma
          automatizada.
        </p>
        <div className="stat-row">
          <StatBadge value={stats?.clients ?? null} label="Clientes" loading={loading} />
          <StatBadge value={stats?.professionals ?? null} label="Técnicos" loading={loading} />
          {stats ? (
            <button
              type="button"
              onClick={() => setShowContracts(true)}
              className="stat-badge--clickable"
              aria-label="Abrir lista de técnicos sem agenda"
            >
              <StatBadge
                value={stats.contractsWithSchedule}
                label={`Agendas geradas de ${stats.totalContracts}`}
              />
            </button>
          ) : (
            <StatBadge value={null} label="Agendas geradas" loading />
          )}
        </div>
      </header>

      <div className="home-grid">
        <section className="glass-panel animate-fade-in home-card home-card--delay-1">
          <div className="home-card__number" aria-hidden="true">
            01
          </div>
          <h2 className="home-card__title">
            <span className="home-card__emoji" aria-hidden="true">
              📋
            </span>{' '}
            Gestão de Ativos
          </h2>
          <p className="home-card__body">
            Controle centralizado de <strong>Técnicos</strong> e <strong>Clientes</strong>.
            Configure frequências de visita, sistemas (SDAI, CFTV) e preferências de agenda.
          </p>
          <div className="home-card__actions">
            <Link href="/clients" className="btn-primary">
              Contratos
            </Link>
            <Link href="/professionals" className="btn-secondary">
              Técnicos
            </Link>
          </div>
        </section>

        <section className="glass-panel animate-fade-in home-card home-card--delay-2">
          <div className="home-card__number" aria-hidden="true">
            02
          </div>
          <h2 className="home-card__title">
            <span className="home-card__emoji" aria-hidden="true">
              📅
            </span>{' '}
            Cronograma Anual
          </h2>
          <p className="home-card__body">
            Visualização estratégica da agenda. Gere visitas automáticas, valide conflitos e agende
            testes trimestrais obrigatórios com precisão cirúrgica.
          </p>
          <div className="home-card__actions home-card__actions--single">
            <Link href="/calendar" className="btn-primary">
              Visualizar Calendário Completo
            </Link>
          </div>
        </section>
      </div>

      <Modal
        isOpen={showContracts}
        onClose={() => setShowContracts(false)}
        title="Técnicos sem agenda"
        maxWidth="400px"
      >
        {pendingTechs.length === 0 ? (
          <p className="pending-tech-empty">Todos os técnicos possuem agenda gerada.</p>
        ) : (
          <ul className="pending-tech-list">
            {pendingTechs.map((name) => (
              <li key={name} className="pending-tech-item">
                <span className="pending-tech-item__icon" aria-hidden="true">
                  ⚠️
                </span>
                <strong className="pending-tech-item__name">{name}</strong>
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <footer className="home-footer">
        <p>
          © {new Date().getFullYear()} CompaSSS — Companhia de Parceria em Soluções e Serviços em
          Sistemas
        </p>
      </footer>
    </div>
  );
}
