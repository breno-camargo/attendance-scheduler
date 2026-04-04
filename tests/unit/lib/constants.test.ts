import { describe, it, expect } from 'vitest';

import { migrateRole, UNIQUE_ROLES, MAINT_ROLES } from '@/lib/constants';

// ─────────────────────────────────────────────
// migrateRole
// ─────────────────────────────────────────────
describe('migrateRole', () => {
  it('maps "Lider de equipe" to the canonical role', () => {
    expect(migrateRole('Lider de equipe')).toBe('Técnico de Sistemas (Líder)');
  });

  it('maps "Técnico de Sistemas Líder" to the canonical role', () => {
    expect(migrateRole('Técnico de Sistemas Líder')).toBe('Técnico de Sistemas (Líder)');
  });

  it('maps "Técnico Líder de Equipe" to the canonical role', () => {
    expect(migrateRole('Técnico Líder de Equipe')).toBe('Técnico de Sistemas (Líder)');
  });

  it('maps "Tec Líder de Equipe" to the canonical role', () => {
    expect(migrateRole('Tec Líder de Equipe')).toBe('Técnico de Sistemas (Líder)');
  });

  it('returns the canonical role unchanged when passed directly', () => {
    expect(migrateRole('Técnico de Sistemas (Líder)')).toBe('Técnico de Sistemas (Líder)');
  });

  it('returns a completely unknown role string unchanged', () => {
    expect(migrateRole('Unknown Role XYZ')).toBe('Unknown Role XYZ');
  });

  it('returns an empty string unchanged', () => {
    expect(migrateRole('')).toBe('');
  });

  it('returns "Supervisor" unchanged (already canonical)', () => {
    expect(migrateRole('Supervisor')).toBe('Supervisor');
  });

  it('returns "Gerente" unchanged (already canonical)', () => {
    expect(migrateRole('Gerente')).toBe('Gerente');
  });

  it('returns "Coordenador" unchanged (already canonical)', () => {
    expect(migrateRole('Coordenador')).toBe('Coordenador');
  });

  it('is case-sensitive – does not match a different-case legacy name', () => {
    // "lider de equipe" (all lowercase) is NOT in LEGACY_ROLES, so returned unchanged
    expect(migrateRole('lider de equipe')).toBe('lider de equipe');
  });
});

// ─────────────────────────────────────────────
// UNIQUE_ROLES
// ─────────────────────────────────────────────
describe('UNIQUE_ROLES', () => {
  it('has exactly 4 entries', () => {
    expect(UNIQUE_ROLES).toHaveLength(4);
  });

  it('contains "Técnico de Sistemas (Líder)"', () => {
    expect(UNIQUE_ROLES).toContain('Técnico de Sistemas (Líder)');
  });

  it('contains "Supervisor"', () => {
    expect(UNIQUE_ROLES).toContain('Supervisor');
  });

  it('contains "Gerente"', () => {
    expect(UNIQUE_ROLES).toContain('Gerente');
  });

  it('contains "Coordenador"', () => {
    expect(UNIQUE_ROLES).toContain('Coordenador');
  });

  it('is an array', () => {
    expect(Array.isArray(UNIQUE_ROLES)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// MAINT_ROLES
// ─────────────────────────────────────────────
describe('MAINT_ROLES', () => {
  it('has exactly 3 entries', () => {
    expect(MAINT_ROLES).toHaveLength(3);
  });

  it('contains "Técnico de Sistemas (Líder)"', () => {
    expect(MAINT_ROLES).toContain('Técnico de Sistemas (Líder)');
  });

  it('contains "Supervisor"', () => {
    expect(MAINT_ROLES).toContain('Supervisor');
  });

  it('contains "Coordenador"', () => {
    expect(MAINT_ROLES).toContain('Coordenador');
  });

  it('does NOT contain "Gerente"', () => {
    expect(MAINT_ROLES).not.toContain('Gerente');
  });

  it('is an array', () => {
    expect(Array.isArray(MAINT_ROLES)).toBe(true);
  });

  it('is a strict subset of UNIQUE_ROLES', () => {
    for (const role of MAINT_ROLES) {
      expect(UNIQUE_ROLES).toContain(role);
    }
  });
});
