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

import { POST } from '@/app/api/schedule/generate/preview/route';
import prisma from '@/lib/prisma';

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

const VALID_PROF_ID = 'cabcdefghijklmnopqrstuvwx';

interface ContractOverrides {
  id?: string;
  clientId?: string;
  clientName?: string;
  systemTypes?: string | null;
  visitsPerMonth?: number;
  frequency?: 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';
  targetMonths?: string | null;
  preferredDays?: string | null;
}

function makeContract(idx: number, o: ContractOverrides = {}) {
  const id = o.id ?? `cccccccccccccccccccccc${String(idx).padStart(2, '0')}`;
  const clientId = o.clientId ?? `clclient0000000000000${String(idx).padStart(3, '0')}`;
  return {
    id,
    clientId,
    client: { id: clientId, name: o.clientName ?? `Client ${idx}` },
    professionalId: VALID_PROF_ID,
    systemTypes: o.systemTypes !== undefined ? o.systemTypes : 'SDAI,CFTV',
    visitsPerMonth: o.visitsPerMonth ?? 2,
    frequency: o.frequency ?? 'MONTHLY',
    targetMonths: o.targetMonths ?? null,
    preferredDays: o.preferredDays ?? null,
    active: true,
    contactsJson: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };
}

function makeProfessional(contracts: ContractOverrides[]) {
  return {
    id: VALID_PROF_ID,
    name: 'Técnico Teste',
    email: 'tec@ex.com',
    phone: null,
    supervisorId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    contracts: contracts.map((c, i) => makeContract(i, c)),
  };
}

async function runPreview(body: any = { professionalId: VALID_PROF_ID, year: 2027 }) {
  const req = new Request('http://localhost/api/schedule/generate/preview', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  const response = await POST(req);
  const responseBody = await response.json();
  return { status: response.status, responseBody };
}

beforeEach(() => {
  mockReset(prismaMock);
  mockGetServerSession.mockResolvedValue({ user: { name: 'Admin' } });
  prismaMock.holiday.findMany.mockResolvedValue([]);
  prismaMock.appointment.count.mockResolvedValue(0);
  // Transação mockada pra falhar se alguém tentar — preview nunca deve chamar.
  prismaMock.$transaction.mockImplementation(async (cb: any) =>
    typeof cb === 'function' ? cb(prismaMock) : cb,
  );
});

describe('POST /api/schedule/generate/preview — auth & validação', () => {
  it('retorna 401 sem sessão', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const { status } = await runPreview();
    expect(status).toBe(401);
  });

  it('retorna 400 quando professionalId está ausente', async () => {
    const { status } = await runPreview({ year: 2027 });
    expect(status).toBe(400);
  });

  it('retorna 400 quando professionalId não bate com regex cuid', async () => {
    const { status } = await runPreview({ professionalId: 'invalid', year: 2027 });
    expect(status).toBe(400);
  });

  it('retorna 400 para ano fora do intervalo', async () => {
    const { status: s1 } = await runPreview({ professionalId: VALID_PROF_ID, year: 2019 });
    const { status: s2 } = await runPreview({ professionalId: VALID_PROF_ID, year: 2101 });
    expect(s1).toBe(400);
    expect(s2).toBe(400);
  });
});

describe('POST /api/schedule/generate/preview — estado inválido', () => {
  it('retorna 404 quando técnico não existe', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(null);
    const { status, responseBody } = await runPreview();
    expect(status).toBe(404);
    expect(responseBody.error).toBe('Técnico não encontrado ou sem contratos');
  });

  it('retorna 404 quando técnico não tem contratos', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(makeProfessional([]) as any);
    const { status } = await runPreview();
    expect(status).toBe(404);
  });
});

describe('POST /api/schedule/generate/preview — resumo', () => {
  it('retorna count, contractCount, byType, byMonth e appointments', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([
        { frequency: 'MONTHLY', systemTypes: 'SDAI,CFTV', visitsPerMonth: 2 },
      ]) as any,
    );
    const { status, responseBody } = await runPreview();

    expect(status).toBe(200);
    expect(responseBody).toHaveProperty('count');
    expect(responseBody).toHaveProperty('contractCount');
    expect(responseBody).toHaveProperty('byType');
    expect(responseBody).toHaveProperty('byMonth');
    expect(responseBody).toHaveProperty('appointments');

    // 20 visitas + 4 SDAI = 24 total (mesmo shape do generate)
    expect(responseBody.count).toBe(24);
    expect(responseBody.contractCount).toBe(1);
    expect(responseBody.byType).toEqual({ VISITA_TECNICA: 20, TESTE_SDAI: 4 });
    expect(responseBody.appointments).toHaveLength(24);
  });

  it('byMonth tem chaves 0-11 com contagem por tipo', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 1 }]) as any,
    );
    const { responseBody } = await runPreview();

    const months = Object.keys(responseBody.byMonth)
      .map(Number)
      .sort((a, b) => a - b);
    expect(months).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    for (const m of months) {
      expect(responseBody.byMonth[m]).toHaveProperty('VISITA_TECNICA');
      expect(responseBody.byMonth[m]).toHaveProperty('TESTE_SDAI');
    }
    // Soma dos meses bate com byType
    const totalVisitas = months.reduce((sum, m) => sum + responseBody.byMonth[m].VISITA_TECNICA, 0);
    expect(totalVisitas).toBe(responseBody.byType.VISITA_TECNICA);
  });

  it('byMonth reflete meses ativos (QUARTERLY só em alguns meses)', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([
        { frequency: 'QUARTERLY', systemTypes: 'CFTV', targetMonths: '0,3,6,9' },
      ]) as any,
    );
    const { responseBody } = await runPreview();

    const monthsWithVisits = Object.entries(responseBody.byMonth)
      .filter(([, counts]) => (counts as any).VISITA_TECNICA > 0)
      .map(([m]) => Number(m))
      .sort((a, b) => a - b);
    expect(monthsWithVisits).toEqual([0, 3, 6, 9]);
  });

  it('existingCount é 0 quando não há agenda anterior no ano alvo', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 1 }]) as any,
    );
    prismaMock.appointment.count.mockResolvedValue(0);
    const { responseBody } = await runPreview();
    expect(responseBody.existingCount).toBe(0);
  });

  it('existingCount reflete quantidade retornada pelo count no escopo do ano', async () => {
    const prof = makeProfessional([
      { frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 1 },
    ]);
    prismaMock.professional.findUnique.mockResolvedValue(prof as any);
    prismaMock.appointment.count.mockResolvedValue(17);

    const { responseBody } = await runPreview({ professionalId: VALID_PROF_ID, year: 2027 });

    expect(responseBody.existingCount).toBe(17);
    // Escopo do count precisa bater com o do deleteMany (professionalId OR contractId in [...], date ano)
    expect(prismaMock.appointment.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { professionalId: prof.id },
          { contractId: { in: prof.contracts.map((c: any) => c.id) } },
        ],
        date: {
          gte: new Date(Date.UTC(2027, 0, 1)),
          lt: new Date(Date.UTC(2028, 0, 1)),
        },
      },
    });
  });
});

describe('POST /api/schedule/generate/preview — warnings', () => {
  it('response inclui warnings vazios quando config está OK', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 1 }]) as any,
    );
    const { responseBody } = await runPreview();
    expect(responseBody.warnings).toEqual([]);
  });

  it('forward warnings computadas pelo service (SDAI em não-mensal)', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([
        { frequency: 'BIMONTHLY', systemTypes: 'SDAI,CFTV', visitsPerMonth: 1 },
      ]) as any,
    );
    const { responseBody } = await runPreview();
    expect(responseBody.warnings).toHaveLength(1);
    expect(responseBody.warnings[0].code).toBe('NON_MONTHLY_SDAI');
  });

  it('inclui múltiplas warnings de contratos diferentes', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([
        { frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 0 },
        { frequency: 'BIMONTHLY', systemTypes: 'SDAI' },
        { frequency: 'QUARTERLY', systemTypes: 'CFTV', targetMonths: 'invalid' },
      ]) as any,
    );
    const { responseBody } = await runPreview();
    const codes = responseBody.warnings.map((w: any) => w.code).sort();
    expect(codes).toEqual(['INVALID_TARGET_MONTHS', 'NON_MONTHLY_SDAI', 'NO_MONTHLY_VISITS']);
  });
});

describe('POST /api/schedule/generate/preview — não persiste', () => {
  it('não chama $transaction, deleteMany nem createMany', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([
        { frequency: 'MONTHLY', systemTypes: 'SDAI,CFTV', visitsPerMonth: 2 },
      ]) as any,
    );
    const { status } = await runPreview();

    expect(status).toBe(200);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.appointment.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.appointment.createMany).not.toHaveBeenCalled();
  });

  it('mesmo com erro de validação não toca no banco', async () => {
    const { status } = await runPreview({ professionalId: 'invalid' });
    expect(status).toBe(400);
    expect(prismaMock.professional.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(prismaMock.appointment.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.appointment.createMany).not.toHaveBeenCalled();
  });
});
