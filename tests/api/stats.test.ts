import type { PrismaClient } from '@prisma/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const mockGetServerSession = vi
  .fn()
  .mockResolvedValue({ user: { name: 'Admin', role: 'Coordenador' } });
vi.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { GET } from '@/app/api/stats/route';
import prisma from '@/lib/prisma';

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
    prismaMock.contract.findMany.mockResolvedValue([
      {
        id: 'c1',
        systemTypes: 'SDAI,CFTV',
        client: { name: 'Client 1' },
        professional: { name: 'Tec A' },
      },
      {
        id: 'c2',
        systemTypes: 'CFTV',
        client: { name: 'Client 2' },
        professional: { name: 'Tec B' },
      },
      {
        id: 'c3',
        systemTypes: null,
        client: { name: 'Client 3' },
        professional: null,
      },
      {
        id: 'c4',
        systemTypes: null,
        client: { name: 'Client 4' },
        professional: null,
      },
      {
        id: 'c5',
        systemTypes: null,
        client: { name: 'Client 5' },
        professional: null,
      },
      {
        id: 'c6',
        systemTypes: null,
        client: { name: 'Client 6' },
        professional: null,
      },
      {
        id: 'c7',
        systemTypes: null,
        client: { name: 'Client 7' },
        professional: null,
      },
    ] as any);
    prismaMock.appointment.findMany.mockResolvedValue([
      { contractId: 'c1' },
      { contractId: 'c2' },
    ] as any);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      clients: 5,
      professionals: 3,
      totalContracts: 7,
      contractsWithSchedule: 2,
    });
    expect(body.contractsDetail).toHaveLength(7);
    expect(body.contractsDetail[0]).toMatchObject({
      id: 'c1',
      clientName: 'Client 1',
      professionalName: 'Tec A',
      hasSchedule: true,
    });
  });

  it('returns zero counts when database is empty', async () => {
    prismaMock.client.count.mockResolvedValue(0);
    prismaMock.professional.count.mockResolvedValue(0);
    prismaMock.contract.findMany.mockResolvedValue([]);
    prismaMock.appointment.findMany.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      clients: 0,
      professionals: 0,
      totalContracts: 0,
      contractsWithSchedule: 0,
      contractsDetail: [],
    });
  });

  it('returns 500 when a Prisma call throws', async () => {
    prismaMock.client.count.mockRejectedValue(new Error('DB connection failed'));
    prismaMock.professional.count.mockResolvedValue(0);
    prismaMock.contract.findMany.mockResolvedValue([]);
    prismaMock.appointment.findMany.mockResolvedValue([]);

    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 500 when appointment.findMany throws', async () => {
    prismaMock.client.count.mockResolvedValue(2);
    prismaMock.professional.count.mockResolvedValue(1);
    prismaMock.contract.findMany.mockResolvedValue([]);
    prismaMock.appointment.findMany.mockRejectedValue(new Error('findMany failure'));

    const response = await GET();

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});
