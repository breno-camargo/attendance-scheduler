import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockGetToken = vi.fn();

vi.mock('next-auth/jwt', () => ({
  getToken: (...args: any[]) => mockGetToken(...args),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: any, opts: any) => ({
      data,
      headers: new Headers(),
      status: opts?.status || 200,
      type: 'json',
    })),
    next: vi.fn((opts?: any) => ({
      headers: new Headers(),
      requestHeaders: opts?.request?.headers,
      status: 200,
      type: 'next',
    })),
    redirect: vi.fn((url: URL) => ({
      headers: new Headers(),
      status: 307,
      type: 'redirect',
      url: url.toString(),
    })),
  },
}));

import { proxy } from '@/proxy';

function makeRequest(headers: Record<string, string | undefined>) {
  return {
    method: 'POST',
    url: 'https://app.example.com/api/clients',
    nextUrl: { pathname: '/api/clients' },
    headers: {
      get: (key: string) => headers[key.toLowerCase()] ?? null,
    },
  } as any;
}

describe('proxy CSRF protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetToken.mockResolvedValue({ userId: 'user-1' });
  });

  it('blocks mutating requests without Origin or Referer', async () => {
    const response = await proxy(makeRequest({ host: 'app.example.com' }));

    expect(response.status).toBe(403);
    expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'self' 'nonce-");
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('allows mutating requests with same-host Referer', async () => {
    const response = await proxy(
      makeRequest({
        host: 'app.example.com',
        referer: 'https://app.example.com/clients',
      }),
    );

    expect(response.type).toBe('next');
    expect(response.headers.get('Content-Security-Policy')).toContain("'strict-dynamic'");
    expect((response as any).requestHeaders.get('x-nonce')).toBeTruthy();
    expect(mockGetToken).toHaveBeenCalled();
  });

  it('blocks mutating requests with cross-origin Origin', async () => {
    const response = await proxy(
      makeRequest({
        host: 'app.example.com',
        origin: 'https://evil.example.net',
      }),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('Content-Security-Policy')).toContain("object-src 'none'");
    expect(mockGetToken).not.toHaveBeenCalled();
  });
});
