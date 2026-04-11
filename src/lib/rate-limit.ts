import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Rate limit em rotas públicas: login e forgot-password.
// Em dev usa memória pra não depender do Redis; em prod usa Upstash.
const hasRedis = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

const isDev = process.env.NODE_ENV === 'development';
const LOGIN_MAX_ATTEMPTS = isDev ? 50 : 5;
const LOGIN_WINDOW_SECONDS = 15 * 60; // 15 minutos
const FORGOT_MAX_ATTEMPTS = isDev ? 50 : 3;
const FORGOT_WINDOW_SECONDS = 60 * 60; // 1 hora

// ── In-Memory fallback (dev sem Redis) ──
const memoryStore = new Map<string, { count: number; firstAttempt: number }>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function checkMemoryRateLimit(key: string, maxAttempts: number, windowSeconds: number): boolean {
  const now = Date.now();
  if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
    lastCleanup = now;
    memoryStore.forEach((entry, k) => {
      if (now - entry.firstAttempt > windowSeconds * 1000) {
        memoryStore.delete(k);
      }
    });
  }

  const entry = memoryStore.get(key);
  if (!entry || now - entry.firstAttempt > windowSeconds * 1000) {
    memoryStore.set(key, { count: 1, firstAttempt: now });
    return true;
  }

  if (entry.count >= maxAttempts) return false;
  entry.count++;
  return true;
}

// ── Redis (producao) ──
const redis = hasRedis
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

const loginRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(LOGIN_MAX_ATTEMPTS, `${LOGIN_WINDOW_SECONDS} s`),
      analytics: false,
      prefix: 'compasss:login',
    })
  : null;

const forgotRatelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(FORGOT_MAX_ATTEMPTS, `${FORGOT_WINDOW_SECONDS} s`),
      analytics: false,
      prefix: 'compasss:forgot',
    })
  : null;

export async function checkLoginRateLimit(ip: string): Promise<boolean> {
  if (loginRatelimit) {
    const { success } = await loginRatelimit.limit(ip);
    return success;
  }
  return checkMemoryRateLimit(`login:${ip}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SECONDS);
}

export async function checkForgotPasswordRateLimit(ip: string): Promise<boolean> {
  if (forgotRatelimit) {
    const { success } = await forgotRatelimit.limit(ip);
    return success;
  }
  return checkMemoryRateLimit(`forgot:${ip}`, FORGOT_MAX_ATTEMPTS, FORGOT_WINDOW_SECONDS);
}
