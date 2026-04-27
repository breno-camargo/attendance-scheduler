import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { mockDeep } from 'vitest-mock-extended';
import { mockReset } from 'vitest-mock-extended';

vi.mock('@/lib/prisma', async () => {
  const { mockDeep } = await import('vitest-mock-extended');
  return { default: mockDeep<PrismaClient>() };
});

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: any, opts: any) => ({
      json: async () => data,
      status: opts?.status || 200,
      data,
    })),
  },
}));

const mockGetServerSession = vi.fn();
vi.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

const mockAudit = vi.fn();
vi.mock('@/lib/audit', () => ({ audit: (...args: any[]) => mockAudit(...args) }));

const mockCheckChangePasswordRateLimit = vi.fn();
const mockCheckResetPasswordRateLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  checkChangePasswordRateLimit: (...args: any[]) => mockCheckChangePasswordRateLimit(...args),
  checkResetPasswordRateLimit: (...args: any[]) => mockCheckResetPasswordRateLimit(...args),
}));

import { POST as changePassword } from '@/app/api/auth/change-password/route';
import { POST as resetPassword } from '@/app/api/auth/reset-password/route';
import prisma from '@/lib/prisma';

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function jsonRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/auth/password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
  mockGetServerSession.mockResolvedValue({ user: { id: 'user-1', name: 'Admin' } });
  mockCheckChangePasswordRateLimit.mockResolvedValue(true);
  mockCheckResetPasswordRateLimit.mockResolvedValue(true);
});

describe('POST /api/auth/change-password', () => {
  it('aplica rate limit por usuário autenticado', async () => {
    mockCheckChangePasswordRateLimit.mockResolvedValueOnce(false);

    const response = await changePassword(
      jsonRequest({ currentPassword: 'SenhaAtual123', newPassword: 'NovaSenha123' }),
    );

    expect(response.status).toBe(429);
    expect(mockCheckChangePasswordRateLimit).toHaveBeenCalledWith('user-1');
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it('exige senha atual', async () => {
    const response = await changePassword(jsonRequest({ newPassword: 'NovaSenha123' }));

    expect(response.status).toBe(400);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('bloqueia senha atual incorreta', async () => {
    const currentHash = await bcrypt.hash('SenhaAtual123', 4);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', password: currentHash } as any);

    const response = await changePassword(
      jsonRequest({ currentPassword: 'Errada123', newPassword: 'NovaSenha123' }),
    );

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Senha atual incorreta');
    expect(mockAudit).toHaveBeenCalledWith({
      event: 'PASSWORD_CHANGE_FAILED',
      userId: 'user-1',
    });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('bloqueia reutilização da senha atual', async () => {
    const currentHash = await bcrypt.hash('SenhaAtual123', 4);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', password: currentHash } as any);

    const response = await changePassword(
      jsonRequest({ currentPassword: 'SenhaAtual123', newPassword: 'SenhaAtual123' }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('A nova senha deve ser diferente da senha atual');
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('altera senha quando a senha atual confere', async () => {
    const currentHash = await bcrypt.hash('SenhaAtual123', 4);
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', password: currentHash } as any);
    prismaMock.user.update.mockResolvedValue({} as any);

    const response = await changePassword(
      jsonRequest({ currentPassword: 'SenhaAtual123', newPassword: 'NovaSenha123' }),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ mustChangePassword: false }),
      }),
    );
  });
});

describe('POST /api/auth/reset-password', () => {
  it('aplica rate limit por IP antes de processar token', async () => {
    mockCheckResetPasswordRateLimit.mockResolvedValueOnce(false);

    const response = await resetPassword(
      jsonRequest(
        { token: 'token-1', newPassword: 'NovaSenha123' },
        { 'x-forwarded-for': '203.0.113.10' },
      ),
    );

    expect(response.status).toBe(429);
    expect(mockCheckResetPasswordRateLimit).toHaveBeenCalledWith('203.0.113.10');
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it('bloqueia reutilização da senha atual no reset', async () => {
    const currentHash = await bcrypt.hash('SenhaAtual123', 4);
    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1', password: currentHash } as any);

    const response = await resetPassword(
      jsonRequest({ token: 'token-1', newPassword: 'SenhaAtual123' }),
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('A nova senha deve ser diferente da senha atual');
    expect(prismaMock.user.updateMany).not.toHaveBeenCalled();
  });

  it('redefine senha quando token é válido e senha é nova', async () => {
    const currentHash = await bcrypt.hash('SenhaAtual123', 4);
    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1', password: currentHash } as any);
    prismaMock.user.updateMany.mockResolvedValue({ count: 1 } as any);

    const response = await resetPassword(
      jsonRequest({ token: 'token-1', newPassword: 'NovaSenha123' }),
    );

    expect(response.status).toBe(200);
    expect(prismaMock.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ resetToken: 'token-1' }),
        data: expect.objectContaining({ resetToken: null, resetTokenExpiry: null }),
      }),
    );
  });
});
