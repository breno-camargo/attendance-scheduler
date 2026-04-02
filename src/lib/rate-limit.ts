import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const LOGIN_MAX_ATTEMPTS = process.env.NODE_ENV === 'development' ? 50 : 5;
const LOGIN_WINDOW_SECONDS = 15 * 60; // 15 minutos

// ── In-Memory fallback (dev sem Redis) ──
const memoryStore = new Map<string, { count: number; firstAttempt: number }>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function checkMemoryRateLimit(ip: string): boolean {
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    memoryStore.forEach((entry, key) => {
      if (now - entry.firstAttempt > LOGIN_WINDOW_SECONDS * 1000) {
        memoryStore.delete(key);
      }
    });
  }

  const entry = memoryStore.get(ip);
  if (!entry || now - entry.firstAttempt > LOGIN_WINDOW_SECONDS * 1000) {
    memoryStore.set(ip, { count: 1, firstAttempt: now });
    return true;
  }

  if (entry.count >= LOGIN_MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

// ── Redis (producao) ──
const redisRatelimit = hasRedis
  ? new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      }),
      limiter: Ratelimit.slidingWindow(LOGIN_MAX_ATTEMPTS, `${LOGIN_WINDOW_SECONDS} s`),
      analytics: false,
      prefix: 'compasss:login',
    })
  : null;

export async function checkLoginRateLimit(ip: string): Promise<boolean> {
  if (redisRatelimit) {
    const { success } = await redisRatelimit.limit(ip);
    return success;
  }
  return checkMemoryRateLimit(ip);
}
