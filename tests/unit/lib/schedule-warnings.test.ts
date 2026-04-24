import { describe, expect, it } from 'vitest';

import { computeScheduleWarnings, type WarningContract } from '@/lib/schedule-warnings';

function makeContract(overrides: Partial<WarningContract> = {}): WarningContract {
  return {
    id: 'ccontract0000000000000001',
    frequency: 'MONTHLY',
    systemTypes: 'CFTV',
    visitsPerMonth: 1,
    targetMonths: null,
    client: { name: 'Edifício Teste' },
    ...overrides,
  };
}

describe('computeScheduleWarnings', () => {
  describe('NON_MONTHLY_SDAI', () => {
    it('emite warning quando contrato BIMONTHLY inclui SDAI', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ frequency: 'BIMONTHLY', systemTypes: 'SDAI,CFTV' }),
      ]);

      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({
        code: 'NON_MONTHLY_SDAI',
        contractId: 'ccontract0000000000000001',
        clientName: 'Edifício Teste',
      });
    });

    it('emite pra qualquer frequência não-mensal', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ id: 'c1', frequency: 'QUARTERLY', systemTypes: 'SDAI' }),
        makeContract({ id: 'c2', frequency: 'SEMIANNUAL', systemTypes: 'SDAI' }),
        makeContract({ id: 'c3', frequency: 'ANNUAL', systemTypes: 'SDAI' }),
      ]);

      expect(warnings.map((w) => w.code)).toEqual([
        'NON_MONTHLY_SDAI',
        'NON_MONTHLY_SDAI',
        'NON_MONTHLY_SDAI',
      ]);
    });

    it('não emite para MONTHLY com SDAI', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ frequency: 'MONTHLY', systemTypes: 'SDAI,CFTV' }),
      ]);
      expect(warnings).toHaveLength(0);
    });

    it('normaliza case/whitespace no systemTypes', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ frequency: 'BIMONTHLY', systemTypes: ' sdai , cftv ' }),
      ]);
      expect(warnings[0]?.code).toBe('NON_MONTHLY_SDAI');
    });

    it('não confunde "SDAI2" com "SDAI"', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ frequency: 'BIMONTHLY', systemTypes: 'SDAI2,CFTV' }),
      ]);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('NO_MONTHLY_VISITS', () => {
    it('emite quando MONTHLY tem visitsPerMonth=0', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ frequency: 'MONTHLY', visitsPerMonth: 0 }),
      ]);
      expect(warnings[0]?.code).toBe('NO_MONTHLY_VISITS');
    });

    it('emite quando MONTHLY tem visitsPerMonth negativo', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ frequency: 'MONTHLY', visitsPerMonth: -1 }),
      ]);
      expect(warnings[0]?.code).toBe('NO_MONTHLY_VISITS');
    });

    it('não emite pra não-MONTHLY com visitsPerMonth=0', () => {
      // visitsPerMonth não é usado fora de MONTHLY — só MONTHLY precisa desse dado.
      const warnings = computeScheduleWarnings([
        makeContract({ frequency: 'QUARTERLY', visitsPerMonth: 0 }),
      ]);
      expect(warnings).toHaveLength(0);
    });

    it('não emite pra MONTHLY com visitsPerMonth >= 1', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ frequency: 'MONTHLY', visitsPerMonth: 1 }),
      ]);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('INVALID_TARGET_MONTHS', () => {
    it('emite quando targetMonths só tem tokens inválidos', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ frequency: 'QUARTERLY', targetMonths: ', invalid , x' }),
      ]);
      expect(warnings[0]?.code).toBe('INVALID_TARGET_MONTHS');
    });

    it('emite quando targetMonths só tem números fora de 0..11', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ frequency: 'QUARTERLY', targetMonths: '15, 20' }),
      ]);
      expect(warnings[0]?.code).toBe('INVALID_TARGET_MONTHS');
    });

    it('não emite quando pelo menos um mês válido está presente', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ frequency: 'QUARTERLY', targetMonths: '0, 15' }),
      ]);
      expect(warnings).toHaveLength(0);
    });

    it('não emite quando targetMonths é null ou string vazia (default legítimo)', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ id: 'c1', frequency: 'QUARTERLY', targetMonths: null }),
        makeContract({ id: 'c2', frequency: 'QUARTERLY', targetMonths: '' }),
      ]);
      expect(warnings).toHaveLength(0);
    });

    it('não emite pra MONTHLY mesmo com targetMonths inválido', () => {
      // MONTHLY ignora targetMonths; avisar ali seria ruído.
      const warnings = computeScheduleWarnings([
        makeContract({ frequency: 'MONTHLY', targetMonths: 'invalid' }),
      ]);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('combinações e formato', () => {
    it('acumula múltiplas warnings no mesmo contrato', () => {
      const warnings = computeScheduleWarnings([
        makeContract({
          frequency: 'MONTHLY',
          systemTypes: 'CFTV',
          visitsPerMonth: 0,
        }),
      ]);
      expect(warnings.map((w) => w.code)).toContain('NO_MONTHLY_VISITS');
    });

    it('retorna [] quando não há contratos', () => {
      expect(computeScheduleWarnings([])).toEqual([]);
    });

    it('omite clientName quando client é null ou undefined', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ frequency: 'BIMONTHLY', systemTypes: 'SDAI', client: null }),
      ]);
      expect(warnings[0]?.clientName).toBeUndefined();
    });

    it('preserva ordem de entrada dos contratos', () => {
      const warnings = computeScheduleWarnings([
        makeContract({ id: 'a', frequency: 'MONTHLY', visitsPerMonth: 0 }),
        makeContract({ id: 'b', frequency: 'BIMONTHLY', systemTypes: 'SDAI' }),
      ]);
      expect(warnings.map((w) => w.contractId)).toEqual(['a', 'b']);
    });
  });
});
