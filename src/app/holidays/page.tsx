'use client';
import { useCallback, useEffect, useState } from 'react';

import { useConfirm } from '@/components/ui/confirm-modal';
import { GlassCard } from '@/components/ui/glass-card';
import { useToast } from '@/components/ui/toast';
import { holidaysApi } from '@/lib/api-client';
import type { Holiday } from '@/types';

const SP_HOLIDAYS = ['Aniversário de São Paulo', 'Revolução Constitucionalista de 1932'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export default function HolidaysPage() {
  const { showToast } = useToast();
  const [confirmModal, confirm] = useConfirm();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [yearReady, setYearReady] = useState(false);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('calendar-year');
    if (saved) setYear(parseInt(saved));
    setYearReady(true);
  }, []);

  const fetchHolidays = useCallback(async () => {
    if (!yearReady) return;
    try {
      const { data, error } = await holidaysApi.list(year);
      if (error) throw new Error(error);
      setHolidays(data ?? []);
    } catch {
      showToast('Erro ao carregar feriados', 'error');
    }
  }, [showToast, year, yearReady]);

  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !name.trim()) return;

    setLoading(true);
    try {
      const { ok, error } = await holidaysApi.create({ date, name: name.trim() });
      if (!ok) {
        showToast(error || 'Erro ao adicionar feriado', 'error');
        return;
      }
      setDate('');
      setName('');
      showToast('Feriado adicionado com sucesso');
      await fetchHolidays();
    } catch {
      showToast('Falha de conexão. Tente novamente.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, holidayName: string) => {
    const ok = await confirm({
      title: 'Excluir feriado',
      message: `Tem certeza que deseja excluir '${holidayName}'?`,
    });
    if (!ok) return;
    try {
      const { ok, error } = await holidaysApi.delete(id);
      if (!ok) {
        showToast(error || 'Erro ao excluir feriado', 'error');
        return;
      }
      showToast('Feriado excluído com sucesso');
      await fetchHolidays();
    } catch {
      showToast('Falha de conexão. Tente novamente.', 'error');
    }
  };

  return (
    <main style={{ padding: '4rem 2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h1 className="title" style={{ margin: 0, fontSize: '3.2rem', letterSpacing: '-1.5px' }}>
              Feriados {year}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                onClick={() => setYear((y) => y - 1)}
                aria-label="Ano anterior"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  borderRadius: '6px',
                  width: '30px',
                  height: '30px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ‹
              </button>
              <button
                onClick={() => setYear((y) => y + 1)}
                aria-label="Próximo ano"
                style={{
                  background: 'var(--input-bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)',
                  borderRadius: '6px',
                  width: '30px',
                  height: '30px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                ›
              </button>
            </div>
          </div>
          <p
            style={{
              color: 'var(--text-muted)',
              marginTop: '0.5rem',
              fontSize: '1.1rem',
              maxWidth: '450px',
            }}
          >
            Gerencie os feriados para evitar agendamentos em datas comemorativas.
          </p>
        </div>
      </div>

      {/* Add holiday form */}
      <GlassCard style={{ marginBottom: '2.5rem' }}>
        <h2
          style={{
            fontSize: '1rem',
            color: 'var(--foreground)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            margin: '0 0 1.5rem 0',
          }}
        >
          Adicionar Feriado
        </h2>
        <form
          onSubmit={handleAdd}
          style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <div className="form-field" style={{ flex: '0 0 auto' }}>
            <label htmlFor="holiday-date" className="form-label">
              Data
            </label>
            <input
              id="holiday-date"
              className="form-input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              style={{ minWidth: '160px' }}
            />
          </div>
          <div className="form-field" style={{ flex: '1 1 200px' }}>
            <label htmlFor="holiday-name" className="form-label">
              Nome do Feriado
            </label>
            <input
              id="holiday-name"
              className="form-input"
              type="text"
              placeholder="Ex: Natal"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-field" style={{ flex: '0 0 auto' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ whiteSpace: 'nowrap' }}
            >
              {loading ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </GlassCard>

      {/* Holidays list */}
      {holidays.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0' }}>
          Nenhum feriado cadastrado para {year}.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {holidays.map((holiday, index) => (
            <li
              key={holiday.id}
              style={{
                animation: `fadeIn 0.6s var(--ease-out-expo) forwards ${index * 0.05}s`,
                opacity: 0,
              }}
            >
              <GlassCard
                style={{
                  marginBottom: '12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1.25rem 1.75rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                  {/* Date badge */}
                  <div
                    style={{
                      minWidth: '90px',
                      padding: '0.5rem 0.75rem',
                      background: 'var(--primary-subtle)',
                      border: '1px solid var(--border)',
                      borderRadius: '10px',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      color: 'var(--primary)',
                      letterSpacing: '0.5px',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatDate(holiday.date)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        fontSize: '1.05rem',
                        fontWeight: 600,
                        color: 'var(--foreground)',
                      }}
                    >
                      {holiday.name}
                    </span>
                    {holiday.fixed &&
                      (() => {
                        const isSP = SP_HOLIDAYS.includes(holiday.name);
                        return (
                          <span
                            style={{
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              padding: '0.2rem 0.6rem',
                              borderRadius: '6px',
                              background: isSP
                                ? 'rgba(59, 130, 246, 0.1)'
                                : 'var(--primary-subtle)',
                              color: isSP ? '#3b82f6' : 'var(--primary)',
                              border: `1px solid ${isSP ? 'rgba(59, 130, 246, 0.25)' : 'var(--border)'}`,
                            }}
                          >
                            {isSP ? 'Estadual (SP)' : 'Nacional'}
                          </span>
                        );
                      })()}
                  </div>
                </div>
                {!holiday.fixed && (
                  <button
                    onClick={() => handleDelete(holiday.id, holiday.name)}
                    className="btn-danger"
                    style={{ flexShrink: 0 }}
                  >
                    Excluir
                  </button>
                )}
              </GlassCard>
            </li>
          ))}
        </ul>
      )}

      {confirmModal}
    </main>
  );
}
