import { describe, expect, it } from 'vitest';

import {
  checkMonthActivity,
  findBestSlot,
  generateYearSchedule,
  type ScheduleContract,
} from '@/lib/schedule-algorithm';

function makeContract(overrides: Partial<ScheduleContract> = {}): ScheduleContract {
  return {
    id: 'ccontract0000000000000001',
    clientId: 'cclient00000000000000001',
    frequency: 'MONTHLY',
    targetMonths: null,
    preferredDays: null,
    systemTypes: 'CFTV',
    visitsPerMonth: 1,
    ...overrides,
  };
}

const dateKeys = (dates: Date[]) => dates.map((date) => date.toISOString().slice(0, 10));

describe('schedule-algorithm', () => {
  describe('checkMonthActivity', () => {
    it('treats MONTHLY contracts as active every month', () => {
      const contract = makeContract({ frequency: 'MONTHLY', targetMonths: '0' });

      expect(Array.from({ length: 12 }, (_, month) => checkMonthActivity(contract, month))).toEqual(
        Array(12).fill(true),
      );
    });

    it('uses targetMonths when a non-monthly contract defines explicit months', () => {
      const contract = makeContract({ frequency: 'SEMIANNUAL', targetMonths: '0, 6' });

      expect(checkMonthActivity(contract, 0)).toBe(true);
      expect(checkMonthActivity(contract, 1)).toBe(false);
      expect(checkMonthActivity(contract, 6)).toBe(true);
    });

    it('ignores malformed target month tokens instead of coercing them to January', () => {
      const contract = makeContract({
        id: 'dcontract0000000000000001',
        frequency: 'QUARTERLY',
        targetMonths: ' , invalid ',
      });

      expect(checkMonthActivity(contract, 0)).toBe(false);
    });

    it('ignores negative target month tokens', () => {
      const contract = makeContract({
        id: 'dcontract0000000000000001',
        frequency: 'QUARTERLY',
        targetMonths: '-1',
      });

      expect(checkMonthActivity(contract, -1)).toBe(false);
    });
  });

  describe('findBestSlot', () => {
    it('prioritizes preferred weekdays when a preferred slot is available', () => {
      const workDays = [
        new Date(Date.UTC(2027, 0, 4)), // Monday
        new Date(Date.UTC(2027, 0, 5)),
        new Date(Date.UTC(2027, 0, 6)),
      ];

      const bestIdx = findBestSlot(workDays, [null, null, null], 1, [1], [], 1, 1);

      expect(bestIdx).toBe(0);
    });

    it('avoids preallocated SDAI dates for technical visits', () => {
      const workDays = [
        new Date(Date.UTC(2027, 0, 4)),
        new Date(Date.UTC(2027, 0, 5)),
        new Date(Date.UTC(2027, 0, 6)),
      ];

      const bestIdx = findBestSlot(
        workDays,
        [null, null, null],
        1,
        [],
        [],
        1,
        1,
        new Set(['2027-01-05']),
      );

      expect(bestIdx).not.toBe(1);
    });
  });

  describe('generateYearSchedule', () => {
    it('generates quarterly SDAI tests only for exact SDAI system tokens', () => {
      const { appointments } = generateYearSchedule(
        [makeContract({ systemTypes: 'SDAI2,CFTV', visitsPerMonth: 1 })],
        2027,
        new Set(),
      );

      expect(appointments.filter((appointment) => appointment.type === 'TESTE_SDAI')).toHaveLength(
        0,
      );
    });

    it('normalizes system tokens before applying SDAI rules', () => {
      const { appointments } = generateYearSchedule(
        [makeContract({ systemTypes: ' sdai , cftv ', visitsPerMonth: 1 })],
        2027,
        new Set(),
      );

      expect(appointments.filter((appointment) => appointment.type === 'TESTE_SDAI')).toHaveLength(
        4,
      );
    });

    it('does not place technical visits on custom holidays', () => {
      const { appointments } = generateYearSchedule(
        [makeContract({ visitsPerMonth: 1, preferredDays: '1' })],
        2027,
        new Set(['2027-01-18']),
      );

      const visits = appointments.filter((appointment) => appointment.type === 'VISITA_TECNICA');
      expect(dateKeys(visits.map((visit) => visit.date))).not.toContain('2027-01-18');
    });

    it('renumbers technical visits chronologically for each contract', () => {
      const { appointments } = generateYearSchedule(
        [makeContract({ visitsPerMonth: 2, systemTypes: 'CFTV' })],
        2027,
        new Set(),
      );

      const visits = appointments
        .filter((appointment) => appointment.type === 'VISITA_TECNICA')
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      expect(visits.map((visit) => visit.observation).slice(0, 3)).toEqual([
        'Visita 01',
        'Visita 02',
        'Visita 03',
      ]);
    });
  });

  describe('generateYearSchedule — warnings Tier B', () => {
    it('não emite warnings quando tudo cabe', () => {
      const { warnings } = generateYearSchedule(
        [makeContract({ visitsPerMonth: 1, systemTypes: 'CFTV' })],
        2027,
        new Set(),
      );
      expect(warnings).toEqual([]);
    });

    it('emite SDAI_FELL_ON_WEEKDAY quando nenhum sábado está disponível no mês', () => {
      // Bloqueia todos os 4 sábados de jan/2027 como feriado: 2, 9, 16, 23, 30.
      // Grupo 0 inclui janeiro, então o contrato vai cair em fallback pra dia útil.
      const holidayKeys = new Set([
        '2027-01-02',
        '2027-01-09',
        '2027-01-16',
        '2027-01-23',
        '2027-01-30',
      ]);
      const { warnings } = generateYearSchedule(
        [makeContract({ visitsPerMonth: 1, systemTypes: 'SDAI' })],
        2027,
        holidayKeys,
      );

      const fallback = warnings.filter((w) => w.code === 'SDAI_FELL_ON_WEEKDAY');
      expect(fallback.length).toBeGreaterThanOrEqual(1);
      // Tem que ser de janeiro (month === 0), e date ISO preenchido
      const jan = fallback.find((w) => w.month === 0);
      expect(jan).toBeDefined();
      expect(jan?.date).toMatch(/^2027-01-/);
    });

    it('emite UNPLACED_VISITS quando o mês não tem dias úteis suficientes', () => {
      // Bloqueia quase todos os dias úteis de janeiro — sobra pouquíssimo.
      const jan27Holidays: string[] = [];
      for (let d = 1; d <= 31; d++) {
        const iso = `2027-01-${String(d).padStart(2, '0')}`;
        // deixa só 1 dia útil livre (dia 4, segunda-feira) — contrato pede 10 visitas,
        // não tem como caber.
        if (iso !== '2027-01-04') jan27Holidays.push(iso);
      }
      const { warnings } = generateYearSchedule(
        [makeContract({ visitsPerMonth: 10, systemTypes: 'CFTV' })],
        2027,
        new Set(jan27Holidays),
      );

      const unplaced = warnings.filter((w) => w.code === 'UNPLACED_VISITS' && w.month === 0);
      expect(unplaced.length).toBe(1);
      expect(unplaced[0].missingCount).toBeGreaterThan(0);
    });
  });
});
