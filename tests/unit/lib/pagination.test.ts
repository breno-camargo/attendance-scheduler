import { describe, it, expect } from 'vitest';

import { parsePagination } from '@/lib/api-utils';

describe('parsePagination', () => {
  it('returns default skip=0, take=200 when no params', () => {
    const result = parsePagination('http://localhost/api/test');
    expect(result).toEqual({ skip: 0, take: 200 });
  });

  it('parses page and limit from query params', () => {
    const result = parsePagination('http://localhost/api/test?page=2&limit=10');
    expect(result).toEqual({ skip: 10, take: 10 });
  });

  it('clamps page to minimum of 1', () => {
    const result = parsePagination('http://localhost/api/test?page=0&limit=10');
    expect(result).toEqual({ skip: 0, take: 10 });
  });

  it('clamps negative page to 1', () => {
    const result = parsePagination('http://localhost/api/test?page=-5&limit=10');
    expect(result).toEqual({ skip: 0, take: 10 });
  });

  it('clamps limit to maximum of 200', () => {
    const result = parsePagination('http://localhost/api/test?page=1&limit=500');
    expect(result).toEqual({ skip: 0, take: 200 });
  });

  it('clamps limit to minimum of 1', () => {
    const result = parsePagination('http://localhost/api/test?page=1&limit=0');
    expect(result).toEqual({ skip: 0, take: 1 });
  });

  it('calculates correct skip for page 3 with limit 20', () => {
    const result = parsePagination('http://localhost/api/test?page=3&limit=20');
    expect(result).toEqual({ skip: 40, take: 20 });
  });

  it('handles NaN values by using defaults', () => {
    const result = parsePagination('http://localhost/api/test?page=abc&limit=xyz');
    expect(result).toEqual({ skip: 0, take: 200 });
  });
});
