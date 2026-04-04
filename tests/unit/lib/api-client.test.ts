import { describe, it, expect, vi, beforeEach } from 'vitest';

import { apiFetch } from '@/lib/api-client';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('returns data on successful GET', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: '1', name: 'Test' }],
    } as Response);

    const result = await apiFetch('/api/test');

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.data).toEqual([{ id: '1', name: 'Test' }]);
    expect(result.error).toBeNull();
  });

  it('returns error message on non-ok response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Dados inválidos' }),
    } as Response);

    const result = await apiFetch('/api/test');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.data).toBeNull();
    expect(result.error).toBe('Dados inválidos');
  });

  it('returns connection error when fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network error'));

    const result = await apiFetch('/api/test');

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toContain('Falha de conexão');
  });

  it('adds Content-Type header when body is provided', async () => {
    const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: '1' }),
    } as Response);

    await apiFetch('/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('skips JSON parsing when raw is true', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);

    const result = await apiFetch('/api/test', { raw: true });

    expect(result.ok).toBe(true);
    expect(result.data).toBeNull();
  });

  it('falls back to status code when no error message in response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const result = await apiFetch('/api/test');

    expect(result.error).toBe('Erro 500');
  });
});
