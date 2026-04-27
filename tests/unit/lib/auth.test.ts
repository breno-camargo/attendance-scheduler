import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { mockDeep } from 'vitest-mock-extended';
import { mockReset } from 'vitest-mock-extended';

vi.mock('@/lib/prisma', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return { default: mockDeep<PrismaClient>() };
});

vi.mock('@/lib/audit', () => ({ audit: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({
  checkAccountRateLimit: vi.fn().mockResolvedValue(true),
  checkLoginRateLimit: vi.fn().mockResolvedValue(true),
  resetAccountRateLimit: vi.fn(),
}));

import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;
const jwtCallback = authOptions.callbacks?.jwt;
const sessionCallback = authOptions.callbacks?.session;

beforeEach(() => {
  mockReset(prismaMock);
  vi.useRealTimers();
});

describe('NextAuth password session revocation', () => {
  it('marca token antigo como invalidado quando senha mudou depois do login', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      active: true,
      mustChangePassword: false,
      passwordChangedAt: new Date(2_000),
    } as any);

    const token = await jwtCallback?.({
      token: { userId: 'user-1', sessionStartedAt: 1_000 },
    } as any);

    expect(token?.sessionInvalidated).toBe(true);
  });

  it('mantém token válido quando sessão começou depois da troca de senha', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      active: true,
      mustChangePassword: false,
      passwordChangedAt: new Date(2_000),
    } as any);

    const token = await jwtCallback?.({
      token: { userId: 'user-1', sessionStartedAt: 3_000 },
    } as any);

    expect(token?.sessionInvalidated).toBe(false);
  });

  it('renova início da sessão quando frontend atualiza após troca de senha', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(3_000));
    prismaMock.user.findUnique.mockResolvedValue({
      active: true,
      mustChangePassword: false,
      passwordChangedAt: new Date(2_000),
    } as any);

    const token = await jwtCallback?.({
      token: { userId: 'user-1', sessionStartedAt: 1_000 },
      trigger: 'update',
    } as any);

    expect(token?.sessionStartedAt).toBe(3_000);
    expect(token?.sessionInvalidated).toBe(false);
  });

  it('não derruba sessões se o banco ainda não tiver a coluna nova', async () => {
    prismaMock.user.findUnique.mockRejectedValue(
      new Error('column "passwordChangedAt" does not exist'),
    );

    const token = await jwtCallback?.({
      token: { userId: 'user-1', sessionStartedAt: 1_000 },
    } as any);

    expect(token?.sessionInvalidated).toBe(false);
  });

  it('expõe flag de sessão invalidada para o frontend encerrar o login', async () => {
    const session = await sessionCallback?.({
      session: { user: {}, expires: new Date().toISOString() },
      token: { userId: 'user-1', sessionInvalidated: true },
    } as any);

    expect(
      (session?.user as { sessionInvalidated?: boolean } | undefined)?.sessionInvalidated,
    ).toBe(true);
  });
});

describe('auth password verification', () => {
  it('verifica senha correta contra hash bcrypt', async () => {
    const password = 'test-password-123';
    const hash = await bcrypt.hash(password, 4);
    const result = await bcrypt.compare(password, hash);
    expect(result).toBe(true);
  });

  it('rejeita senha errada contra hash bcrypt', async () => {
    const hash = await bcrypt.hash('correct-password', 4);
    const result = await bcrypt.compare('wrong-password', hash);
    expect(result).toBe(false);
  });

  it('gera hashes diferentes para a mesma senha', async () => {
    const password = 'same-password';
    const hash1 = await bcrypt.hash(password, 4);
    const hash2 = await bcrypt.hash(password, 4);
    expect(hash1).not.toBe(hash2);
    expect(await bcrypt.compare(password, hash1)).toBe(true);
    expect(await bcrypt.compare(password, hash2)).toBe(true);
  });
});
