import { describe, it, expect } from 'vitest';

import {
  clientSchema,
  professionalSchema,
  internalContactSchema,
  appointmentSchema,
  appointmentPatchSchema,
  generateScheduleSchema,
  contactsSchema,
  holidaySchema,
} from '@/lib/schemas';

// ─────────────────────────────────────────────
// clientSchema
// ─────────────────────────────────────────────
describe('clientSchema', () => {
  const validMinimal = {
    name: 'Edificio Teste',
    frequency: 'MONTHLY' as const,
    visitsPerMonth: 2,
  };

  it('accepts a valid minimal object', () => {
    const result = clientSchema.safeParse(validMinimal);
    expect(result.success).toBe(true);
  });

  it('rejects name shorter than 2 characters', () => {
    const result = clientSchema.safeParse({ ...validMinimal, name: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 200 characters', () => {
    const result = clientSchema.safeParse({ ...validMinimal, name: 'A'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('accepts name exactly 2 characters', () => {
    const result = clientSchema.safeParse({ ...validMinimal, name: 'AB' });
    expect(result.success).toBe(true);
  });

  it('accepts name exactly 200 characters', () => {
    const result = clientSchema.safeParse({ ...validMinimal, name: 'A'.repeat(200) });
    expect(result.success).toBe(true);
  });

  it('accepts all valid frequency enum values', () => {
    const freqs = ['MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'] as const;
    for (const frequency of freqs) {
      const result = clientSchema.safeParse({ ...validMinimal, frequency });
      expect(result.success, `frequency ${frequency} should be valid`).toBe(true);
    }
  });

  it('rejects an invalid frequency value', () => {
    const result = clientSchema.safeParse({ ...validMinimal, frequency: 'WEEKLY' });
    expect(result.success).toBe(false);
  });

  it('coerces visitsPerMonth from string to number', () => {
    const result = clientSchema.safeParse({ ...validMinimal, visitsPerMonth: '4' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.visitsPerMonth).toBe(4);
  });

  it('defaults visitsPerMonth to 2 when the value is not a valid number', () => {
    const result = clientSchema.safeParse({ ...validMinimal, visitsPerMonth: 'abc' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.visitsPerMonth).toBe(2);
  });

  it('accepts optional phone as undefined', () => {
    const result = clientSchema.safeParse({ ...validMinimal });
    expect(result.success).toBe(true);
  });

  it('accepts optional phone as empty string', () => {
    const result = clientSchema.safeParse({ ...validMinimal, phone: '' });
    expect(result.success).toBe(true);
  });

  it('accepts optional phone as a valid string', () => {
    const result = clientSchema.safeParse({ ...validMinimal, phone: '(11) 91234-5678' });
    expect(result.success).toBe(true);
  });

  it('accepts optional fields targetMonths, professionalId, systemTypes, preferredDays', () => {
    const result = clientSchema.safeParse({
      ...validMinimal,
      targetMonths: '1,3,6',
      professionalId: 'cabcdefghijklmnopqrstuvwx',
      systemTypes: 'SDAI, Sprinkler',
      preferredDays: 'Monday',
    });
    expect(result.success).toBe(true);
  });

  it('rejects if required name is missing', () => {
    const { name: _n, ...withoutName } = validMinimal;
    const result = clientSchema.safeParse(withoutName);
    expect(result.success).toBe(false);
  });

  it('rejects if required frequency is missing', () => {
    const { frequency: _f, ...withoutFrequency } = validMinimal;
    const result = clientSchema.safeParse(withoutFrequency);
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// professionalSchema
// ─────────────────────────────────────────────
describe('professionalSchema', () => {
  const valid = {
    name: 'Carlos Silva',
    email: 'carlos@example.com',
  };

  it('accepts a valid professional object', () => {
    const result = professionalSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email address', () => {
    const result = professionalSchema.safeParse({ ...valid, email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty email', () => {
    const result = professionalSchema.safeParse({ ...valid, email: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a name shorter than 2 characters', () => {
    const result = professionalSchema.safeParse({ ...valid, name: 'X' });
    expect(result.success).toBe(false);
  });

  it('accepts phone as optional (undefined)', () => {
    const result = professionalSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('accepts phone as empty string', () => {
    const result = professionalSchema.safeParse({ ...valid, phone: '' });
    expect(result.success).toBe(true);
  });

  it('accepts phone as a valid string value', () => {
    const result = professionalSchema.safeParse({ ...valid, phone: '(11) 91234-5678' });
    expect(result.success).toBe(true);
  });

  it('rejects if email is missing', () => {
    const { email: _e, ...withoutEmail } = valid;
    const result = professionalSchema.safeParse(withoutEmail);
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// internalContactSchema
// ─────────────────────────────────────────────
describe('internalContactSchema', () => {
  const validMinimal = { name: 'A' };

  it('accepts a valid minimal object with just a name (1 char)', () => {
    const result = internalContactSchema.safeParse(validMinimal);
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = internalContactSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('accepts optional role, phone, email as undefined', () => {
    const result = internalContactSchema.safeParse({ name: 'Bob' });
    expect(result.success).toBe(true);
  });

  it('accepts optional fields as empty strings', () => {
    const result = internalContactSchema.safeParse({
      name: 'Bob',
      role: '',
      phone: '',
      email: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional fields with valid values', () => {
    const result = internalContactSchema.safeParse({
      name: 'Bob',
      role: 'Supervisor',
      phone: '(11) 91234-5678',
      email: 'bob@test.com',
    });
    expect(result.success).toBe(true);
  });

  it('rejects if name is missing entirely', () => {
    const result = internalContactSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// appointmentSchema
// ─────────────────────────────────────────────
describe('appointmentSchema', () => {
  const validAppointment = {
    clientId: 'client_01',
    professionalId: 'cabcdefghijklmnopqrstuvwx',
    date: '2026-04-10',
  };

  it('accepts a valid minimal appointment', () => {
    const result = appointmentSchema.safeParse(validAppointment);
    expect(result.success).toBe(true);
  });

  it('rejects when clientId is missing', () => {
    const { clientId: _c, ...without } = validAppointment;
    const result = appointmentSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects when professionalId is missing', () => {
    const { professionalId: _p, ...without } = validAppointment;
    const result = appointmentSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects when date is missing', () => {
    const { date: _d, ...without } = validAppointment;
    const result = appointmentSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects an invalid date string', () => {
    const result = appointmentSchema.safeParse({ ...validAppointment, date: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('accepts a valid ISO date-time string', () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      date: '2026-04-10T14:30:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('defaults type to "VISITA_TECNICA" when not provided', () => {
    const result = appointmentSchema.safeParse(validAppointment);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('VISITA_TECNICA');
  });

  it('accepts type "VISITA_TECNICA" explicitly', () => {
    const result = appointmentSchema.safeParse({ ...validAppointment, type: 'VISITA_TECNICA' });
    expect(result.success).toBe(true);
  });

  it('accepts type "TESTE_SDAI"', () => {
    const result = appointmentSchema.safeParse({ ...validAppointment, type: 'TESTE_SDAI' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid type value', () => {
    const result = appointmentSchema.safeParse({ ...validAppointment, type: 'UNKNOWN_TYPE' });
    expect(result.success).toBe(false);
  });

  it('defaults observation to empty string when not provided', () => {
    const result = appointmentSchema.safeParse(validAppointment);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.observation).toBe('');
  });

  it('rejects observation longer than 500 characters', () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      observation: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('accepts observation exactly 500 characters', () => {
    const result = appointmentSchema.safeParse({
      ...validAppointment,
      observation: 'x'.repeat(500),
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional contractId as null', () => {
    const result = appointmentSchema.safeParse({ ...validAppointment, contractId: null });
    expect(result.success).toBe(true);
  });

  it('accepts optional contractId as a string', () => {
    const result = appointmentSchema.safeParse({ ...validAppointment, contractId: 'contract_99' });
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────────
// appointmentPatchSchema
// ─────────────────────────────────────────────
describe('appointmentPatchSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    const result = appointmentPatchSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a valid type update', () => {
    const result = appointmentPatchSchema.safeParse({ type: 'TESTE_SDAI' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid observation update', () => {
    const result = appointmentPatchSchema.safeParse({ observation: 'Updated note' });
    expect(result.success).toBe(true);
  });

  it('accepts a valid date update', () => {
    const result = appointmentPatchSchema.safeParse({ date: '2026-06-01' });
    expect(result.success).toBe(true);
  });

  it('accepts all fields provided together', () => {
    const result = appointmentPatchSchema.safeParse({
      type: 'VISITA_TECNICA',
      observation: 'Some note',
      date: '2026-07-15',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid type value', () => {
    const result = appointmentPatchSchema.safeParse({ type: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('rejects observation longer than 500 characters', () => {
    const result = appointmentPatchSchema.safeParse({ observation: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// generateScheduleSchema
// ─────────────────────────────────────────────
describe('generateScheduleSchema', () => {
  it('accepts a valid object with professionalId and year', () => {
    const result = generateScheduleSchema.safeParse({
      professionalId: 'cabcdefghijklmnopqrstuvwx',
      year: 2026,
    });
    expect(result.success).toBe(true);
  });

  it('coerces year from a string to a number', () => {
    const result = generateScheduleSchema.safeParse({
      professionalId: 'cabcdefghijklmnopqrstuvwx',
      year: '2025',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.year).toBe(2025);
  });

  it('defaults year to the current year when not provided', () => {
    const result = generateScheduleSchema.safeParse({
      professionalId: 'cabcdefghijklmnopqrstuvwx',
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.year).toBe(new Date().getFullYear());
  });

  it('rejects year below minimum (2019)', () => {
    const result = generateScheduleSchema.safeParse({
      professionalId: 'cabcdefghijklmnopqrstuvwx',
      year: 2019,
    });
    expect(result.success).toBe(false);
  });

  it('accepts year at minimum boundary (2020)', () => {
    const result = generateScheduleSchema.safeParse({
      professionalId: 'cabcdefghijklmnopqrstuvwx',
      year: 2020,
    });
    expect(result.success).toBe(true);
  });

  it('accepts year at maximum boundary (2100)', () => {
    const result = generateScheduleSchema.safeParse({
      professionalId: 'cabcdefghijklmnopqrstuvwx',
      year: 2100,
    });
    expect(result.success).toBe(true);
  });

  it('rejects year above maximum (2101)', () => {
    const result = generateScheduleSchema.safeParse({
      professionalId: 'cabcdefghijklmnopqrstuvwx',
      year: 2101,
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing professionalId', () => {
    const result = generateScheduleSchema.safeParse({ year: 2026 });
    expect(result.success).toBe(false);
  });

  it('rejects empty professionalId', () => {
    const result = generateScheduleSchema.safeParse({ professionalId: '', year: 2026 });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// contactsSchema
// ─────────────────────────────────────────────
describe('contactsSchema', () => {
  const contactPerson = {
    name: 'John',
    role: 'Tech',
    phone: '(11) 91234-5678',
    email: 'john@test.com',
  };

  const validContacts = {
    maintenance: [contactPerson],
    escalation: [contactPerson],
  };

  it('accepts a valid contacts object', () => {
    const result = contactsSchema.safeParse(validContacts);
    expect(result.success).toBe(true);
  });

  it('accepts empty arrays for both maintenance and escalation', () => {
    const result = contactsSchema.safeParse({ maintenance: [], escalation: [] });
    expect(result.success).toBe(true);
  });

  it('accepts optional action and contact fields on a contact person', () => {
    const result = contactsSchema.safeParse({
      maintenance: [{ ...contactPerson, action: 'call', contact: 'primary' }],
      escalation: [],
    });
    expect(result.success).toBe(true);
  });

  it('rejects maintenance array with more than 20 items', () => {
    const bigArray = Array.from({ length: 21 }, () => contactPerson);
    const result = contactsSchema.safeParse({ maintenance: bigArray, escalation: [] });
    expect(result.success).toBe(false);
  });

  it('rejects escalation array with more than 20 items', () => {
    const bigArray = Array.from({ length: 21 }, () => contactPerson);
    const result = contactsSchema.safeParse({ maintenance: [], escalation: bigArray });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 20 items in maintenance (boundary)', () => {
    const array20 = Array.from({ length: 20 }, () => contactPerson);
    const result = contactsSchema.safeParse({ maintenance: array20, escalation: [] });
    expect(result.success).toBe(true);
  });

  it('accepts exactly 20 items in escalation (boundary)', () => {
    const array20 = Array.from({ length: 20 }, () => contactPerson);
    const result = contactsSchema.safeParse({ maintenance: [], escalation: array20 });
    expect(result.success).toBe(true);
  });

  it('rejects if maintenance is missing', () => {
    const result = contactsSchema.safeParse({ escalation: [] });
    expect(result.success).toBe(false);
  });

  it('rejects if escalation is missing', () => {
    const result = contactsSchema.safeParse({ maintenance: [] });
    expect(result.success).toBe(false);
  });

  it('rejects a contact person missing required name field', () => {
    const { name: _n, ...withoutName } = contactPerson;
    const result = contactsSchema.safeParse({
      maintenance: [withoutName],
      escalation: [],
    });
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────────
// holidaySchema
// ─────────────────────────────────────────────
describe('holidaySchema', () => {
  const valid = { date: '2026-12-25', name: 'Natal' };

  it('accepts a valid holiday', () => {
    const result = holidaySchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('rejects empty date', () => {
    const result = holidaySchema.safeParse({ ...valid, date: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid date string', () => {
    const result = holidaySchema.safeParse({ ...valid, date: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('accepts ISO date-time format', () => {
    const result = holidaySchema.safeParse({ ...valid, date: '2026-12-25T00:00:00.000Z' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = holidaySchema.safeParse({ ...valid, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name longer than 200 characters', () => {
    const result = holidaySchema.safeParse({ ...valid, name: 'x'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('accepts name exactly 200 characters', () => {
    const result = holidaySchema.safeParse({ ...valid, name: 'x'.repeat(200) });
    expect(result.success).toBe(true);
  });

  it('rejects missing date', () => {
    const result = holidaySchema.safeParse({ name: 'Natal' });
    expect(result.success).toBe(false);
  });

  it('rejects missing name', () => {
    const result = holidaySchema.safeParse({ date: '2026-12-25' });
    expect(result.success).toBe(false);
  });
});
