import { describe, it, expect } from 'vitest';

import { parseSystemTypes } from '@/lib/formatting';

describe('parseSystemTypes', () => {
  it('returns empty array for null/undefined/empty', () => {
    expect(parseSystemTypes(null)).toEqual([]);
    expect(parseSystemTypes(undefined)).toEqual([]);
    expect(parseSystemTypes('')).toEqual([]);
  });

  it('splits a single system without commas', () => {
    expect(parseSystemTypes('SDAI')).toEqual(['SDAI']);
  });

  it('splits multiple systems without spaces', () => {
    expect(parseSystemTypes('SDAI,CFTV')).toEqual(['SDAI', 'CFTV']);
  });

  // Reproduz o bug: import salva "SDAI, CFTV" (com espaço como o user digita
  // no Excel) e parsers no front splitavam sem trim — virava " CFTV" como custom
  it('trims whitespace around tokens (regression: imported "SDAI, CFTV")', () => {
    expect(parseSystemTypes('SDAI, CFTV')).toEqual(['SDAI', 'CFTV']);
    expect(parseSystemTypes('SDAI ,  CFTV ,SAP')).toEqual(['SDAI', 'CFTV', 'SAP']);
  });

  it('uppercases tokens for consistent matching against DEFAULT_SYSTEMS', () => {
    expect(parseSystemTypes('sdai, cftv')).toEqual(['SDAI', 'CFTV']);
  });

  it('filters out empty tokens from trailing/leading commas', () => {
    expect(parseSystemTypes(',SDAI,,CFTV,')).toEqual(['SDAI', 'CFTV']);
  });
});
