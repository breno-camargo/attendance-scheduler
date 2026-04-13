import type { PrismaClient } from '@prisma/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { mockDeep } from 'vitest-mock-extended';
import { mockReset } from 'vitest-mock-extended';

// --------------------------------------------------------------------------
// The vi.mock factory is hoisted to the top of the file by Vitest, so any
// module-level variable assigned BELOW it (including imports) is not yet
// initialised when the factory runs. The reliable pattern is to create the
// mock INSIDE the factory, store it on a shared mutable object, and import
// the mocked module to get it back out.
// --------------------------------------------------------------------------
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

const mockGetServerSession = vi.fn().mockResolvedValue({ user: { name: 'Admin', role: 'Coordenador' } });
vi.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

// Import the mocked prisma AFTER vi.mock declarations so we get the mock instance
import { GET } from '@/app/api/stats/route';
import prisma from '@/lib/prisma';

// Cast to the deep mock type to get full mock API
const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

beforeEach(() => {
  mockReset(prismaMock);
  mockGetServerSession.mockResolvedValue({ user: { name: 'Admin', role: 'Coordenador' } });
});

describe('GET /api/stats', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns correct counts for clients, professionals, contracts and schedules', async () => {
    prismaMock.client.count.mockResolvedValue(5);
    prismaMock.professional.count.mockResolvedValue(3);
    prismaMock.contract.count.mockResolvedValue(7);
    (prismaMock.appointment.groupBy as any).mockResolvedValue([
      { contractId: 'c1' },
      { contractId: 'c2' },
    ]);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      clients: 5,
      professionals: 3,
      totalContracts: 7,
      contractsWithSchedule: 2,
    });
  });

  it('returns zero counts when database is empty', async () => {
    prismaMock.client.count.mockResolvedValue(0);
    prismaMock.professional.count.mockResolvedValue(0);
    prismaMock.contract.count.mockResolvedValue(0);
    (prismaMock.appointment.groupBy as any).mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ clients: 0, professionals: 0, totalContracts: 0, contractsWithSchedule: 0 });
  });

  it('returns 500 when a Prisma call throws', async () => {
    prismaMock.client.count.mockRejectedValue(new Error('DB connection failed'));

    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 500 when appointment.groupBy throws', async () => {
    prismaMock.client.count.mockResolvedValue(2);
    prismaMock.professional.count.mockResolvedValue(1);
    (prismaMock.appointment.groupBy as any).mockRejectedValue(new Error('groupBy failure'));

    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});
