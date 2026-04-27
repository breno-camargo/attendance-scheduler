import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCspReportRateLimit = vi.fn();

vi.mock('@/lib/rate-limit', () => ({
  checkCspReportRateLimit: (...args: any[]) => mockCheckCspReportRateLimit(...args),
}));

import { POST } from '@/app/api/csp-report/route';

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckCspReportRateLimit.mockResolvedValue(true);
});

describe('POST /api/csp-report', () => {
  it('registra um relatório CSP e retorna 204', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const request = new Request('http://localhost/api/csp-report', {
      method: 'POST',
      headers: {
        'content-type': 'application/csp-report',
        'x-forwarded-for': '203.0.113.10',
      },
      body: JSON.stringify({
        'csp-report': {
          'document-uri': 'https://app.example.com/login',
          'blocked-uri': 'inline',
          'violated-directive': 'script-src',
          'effective-directive': 'script-src',
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(mockCheckCspReportRateLimit).toHaveBeenCalledWith('203.0.113.10');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[CSP_REPORT]'));
    warnSpy.mockRestore();
  });

  it('retorna 204 sem logar quando o rate limit bloqueia', async () => {
    mockCheckCspReportRateLimit.mockResolvedValueOnce(false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const request = new Request('http://localhost/api/csp-report', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('ignora payload acima do limite declarado', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const request = new Request('http://localhost/api/csp-report', {
      method: 'POST',
      headers: { 'content-length': String(11 * 1024) },
      body: JSON.stringify({ 'csp-report': { 'blocked-uri': 'inline' } }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
