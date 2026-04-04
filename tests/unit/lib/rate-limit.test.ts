import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Upstash modules
vi.mock('@upstash/ratelimit', () => ({ Ratelimit: vi.fn() }));
vi.mock('@upstash/redis', () => ({ Redis: vi.fn() }));

describe('rate-limit (in-memory fallback)', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it('should allow first request', async () => {
    const { checkLoginRateLimit } = await import('@/lib/rate-limit');
    const result = await checkLoginRateLimit('127.0.0.1');
    expect(result).toBe(true);
  });

  it('should block after max attempts in dev (50)', async () => {
    const { checkLoginRateLimit } = await import('@/lib/rate-limit');
    const ip = `test-ip-${Date.now()}`;
    for (let i = 0; i < 50; i++) {
      await checkLoginRateLimit(ip);
    }
    const result = await checkLoginRateLimit(ip);
    expect(result).toBe(false);
  });
});
