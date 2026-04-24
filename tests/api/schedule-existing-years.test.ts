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

const mockGetServerSession = vi.fn().mockResolvedValue({ user: { name: 'Admin' } });
vi.mock('next-auth', () => ({
  getServerSession: (...args: any[]) => mockGetServerSession(...args),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { GET } from '@/app/api/schedule/generate/route';
import prisma from '@/lib/prisma';

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

const VALID_PROF_ID = 'cabcdefghijklmnopqrstuvwx';

async function runGetYears(professionalId?: string) {
  const url = professionalId
    ? `http://localhost/api/schedule/generate?professionalId=${professionalId}`
    : 'http://localhost/api/schedule/generate';
  const response = await GET(new Request(url));
  const body = await response.json();
  return { status: response.status, body };
}

beforeEach(() => {
  mockReset(prismaMock);
  mockGetServerSession.mockResolvedValue({ user: { name: 'Admin' } });
  prismaMock.professional.findUnique.mockResolvedValue({
    id: VALID_PROF_ID,
    contracts: [],
  } as any);
});

describe('GET /api/schedule/generate — anos existentes', () => {
  it('retorna 401 sem sessão', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const { status } = await runGetYears(VALID_PROF_ID);
    expect(status).toBe(401);
  });

  it('retorna [] quando professionalId não é informado', async () => {
    const { body } = await runGetYears();
    expect(body).toEqual([]);
  });

  it('retorna { years: [] } quando técnico não tem nenhuma agenda', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([] as any);
    const { status, body } = await runGetYears(VALID_PROF_ID);
    expect(status).toBe(200);
    expect(body).toEqual({ years: [] });
  });

  it('retorna anos distintos em ordem asc a partir dos appointments', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([
      { date: new Date('2027-03-10') },
      { date: new Date('2025-06-15') },
      { date: new Date('2027-09-01') },
      { date: new Date('2026-01-20') },
      { date: new Date('2025-12-31') },
    ] as any);

    const { status, body } = await runGetYears(VALID_PROF_ID);
    expect(status).toBe(200);
    expect(body).toEqual({ years: [2025, 2026, 2027] });
  });

  it('consulta só o profissional informado quando ele não tem contratos', async () => {
    prismaMock.appointment.findMany.mockResolvedValue([] as any);
    await runGetYears(VALID_PROF_ID);
    expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ professionalId: VALID_PROF_ID }] } }),
    );
  });

  it('inclui contratos do técnico no OR — cobre caso de contrato reassociado', async () => {
    // Regressão: antes o GET filtrava só por professionalId, mas o delete do
    // /generate apaga também por contractId. Sem isso, o preview omitia anos
    // que de fato vão ser apagados.
    prismaMock.professional.findUnique.mockResolvedValue({
      id: VALID_PROF_ID,
      contracts: [{ id: 'ct1' }, { id: 'ct2' }],
    } as any);
    prismaMock.appointment.findMany.mockResolvedValue([{ date: new Date('2026-04-10') }] as any);

    const { body } = await runGetYears(VALID_PROF_ID);
    expect(body).toEqual({ years: [2026] });
    expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ professionalId: VALID_PROF_ID }, { contractId: { in: ['ct1', 'ct2'] } }],
        },
      }),
    );
  });
});
