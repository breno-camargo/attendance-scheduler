'use client';

import { useMemo } from 'react';

import type { Appointment } from '@/types';

interface CalendarGridProps {
  year: number;
  appointments: Appointment[];
  filterContractId: string | null;
  holidays: { date: string; name: string }[];
  onDayClick: (dateStr: string) => void;
}

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function getDaysInMonth(year: number, m: number) {
  return new Date(year, m + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, m: number) {
  return new Date(year, m, 1).getDay();
}

export default function CalendarGrid({
  year,
  appointments,
  filterContractId,
  holidays,
  onDayClick,
}: CalendarGridProps) {
  // pre-computa maps pra não ficar fazendo find/filter em cada célula do calendário
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const key = new Date(a.date).toISOString().split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return map;
  }, [appointments]);

  const holidaySet = useMemo(
    () => new Set(holidays.map((h) => new Date(h.date).toISOString().split('T')[0])),
    [holidays],
  );

  const getAppointment = (dateStr: string) => {
    const list = appointmentsByDate.get(dateStr);
    if (!list) return undefined;
    if (filterContractId) return list.find((a) => a.contractId === filterContractId);
    return list[0];
  };

  const getAppointmentCount = (dateStr: string) => {
    const list = appointmentsByDate.get(dateStr);
    if (!list) return 0;
    if (filterContractId) return list.filter((a) => a.contractId === filterContractId).length;
    return list.length;
  };

  const isHoliday = (dateStr: string) => holidaySet.has(dateStr);

  const getColor = (apt: Appointment | undefined, dateStr: string) => {
    if (!apt) {
      if (isHoliday(dateStr)) return 'var(--cal-holiday)';
      return 'rgba(255,255,255,0.02)';
    }
    if (apt.type === 'TESTE_SDAI') return 'var(--cal-test)';
    if (apt.type === 'VISITA_TECNICA') return 'var(--cal-visit)';
    return '';
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1.5rem',
      }}
    >
      {MONTHS.map((monthStr, m) => {
        const daysInMonth = getDaysInMonth(year, m);
        const firstDay = getFirstDayOfMonth(year, m);
        const blanks = Array.from({ length: firstDay });
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        return (
          <div
            key={m}
            className="glass-panel animate-fade-in"
            style={{ padding: '1.2rem', animationDelay: `${m * 0.05}s` }}
          >
            <h3
              style={{
                textAlign: 'center',
                marginBottom: '1rem',
                color: 'var(--primary)',
                fontSize: '1.1rem',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '1px',
              }}
            >
              {monthStr}
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '6px',
                textAlign: 'center',
                fontSize: '0.7rem',
                fontWeight: '900',
                color: 'var(--text-muted)',
                marginBottom: '10px',
              }}
            >
              <div style={{ color: 'var(--cal-sunday)' }}>D</div>
              <div>S</div>
              <div>T</div>
              <div>Q</div>
              <div>Q</div>
              <div>S</div>
              <div style={{ color: 'var(--cal-saturday)' }}>S</div>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '6px',
              }}
            >
              {blanks.map((_, i) => (
                <div key={`blank-${i}`} />
              ))}
              {days.map((d) => {
                const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                const apt = getAppointment(dateStr);
                const aptCount = getAppointmentCount(dateStr);
                const color = getColor(apt, dateStr);

                return (
                  <div
                    key={d}
                    onClick={() => onDayClick(dateStr)}
                    style={{
                      padding: '8px 0',
                      textAlign: 'center',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      background: color,
                      color: apt
                        ? apt.type === 'TESTE_SDAI'
                          ? '#000'
                          : 'white'
                        : 'var(--text-muted)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      border: apt ? 'none' : '1px solid rgba(255,255,255,0.03)',
                      transition: 'var(--transition-fast)',
                      boxShadow:
                        apt && apt.type === 'TESTE_SDAI' ? '0 0 15px var(--primary-glow)' : 'none',
                      height: '42px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-4px) scale(1.1)';
                      e.currentTarget.style.zIndex = '10';
                      if (!apt) e.currentTarget.style.borderColor = 'var(--primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0) scale(1)';
                      e.currentTarget.style.zIndex = '1';
                      if (!apt) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.03)';
                    }}
                    title={
                      apt
                        ? `${apt.client?.name}: ${apt.type}${aptCount > 1 ? ` (+${aptCount - 1} mais)` : ''}`
                        : ''
                    }
                  >
                    {d}
                    {apt && (
                      <div
                        style={{
                          width: '4px',
                          height: '4px',
                          borderRadius: '50%',
                          background: apt.type === 'TESTE_SDAI' ? '#000' : 'white',
                          marginTop: '2px',
                        }}
                      />
                    )}
                    {aptCount > 1 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: '2px',
                          right: '3px',
                          fontSize: '0.55rem',
                          fontWeight: 900,
                          lineHeight: 1,
                          color: apt?.type === 'TESTE_SDAI' ? '#000' : 'white',
                        }}
                      >
                        +{aptCount - 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
