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
      const appointments = generateYearSchedule(
        [makeContract({ systemTypes: 'SDAI2,CFTV', visitsPerMonth: 1 })],
        2027,
        new Set(),
      );

      expect(appointments.filter((appointment) => appointment.type === 'TESTE_SDAI')).toHaveLength(
        0,
      );
    });

    it('normalizes system tokens before applying SDAI rules', () => {
      const appointments = generateYearSchedule(
        [makeContract({ systemTypes: ' sdai , cftv ', visitsPerMonth: 1 })],
        2027,
        new Set(),
      );

      expect(appointments.filter((appointment) => appointment.type === 'TESTE_SDAI')).toHaveLength(
        4,
      );
    });

    it('does not place technical visits on custom holidays', () => {
      const appointments = generateYearSchedule(
        [makeContract({ visitsPerMonth: 1, preferredDays: '1' })],
        2027,
        new Set(['2027-01-18']),
      );

      const visits = appointments.filter((appointment) => appointment.type === 'VISITA_TECNICA');
      expect(dateKeys(visits.map((visit) => visit.date))).not.toContain('2027-01-18');
    });

    it('renumbers technical visits chronologically for each contract', () => {
      const appointments = generateYearSchedule(
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
});
