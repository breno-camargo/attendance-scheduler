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
vi.mock('@/lib/audit', () => ({ audit: vi.fn() }));

import { POST } from '@/app/api/schedule/generate/route';
import prisma from '@/lib/prisma';

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

// ---------------------------------------------------------------------------
// Helpers / Fixtures
// ---------------------------------------------------------------------------

type Frequency = 'MONTHLY' | 'BIMONTHLY' | 'QUARTERLY' | 'SEMIANNUAL' | 'ANNUAL';

interface ContractOverrides {
  id?: string;
  clientId?: string;
  clientName?: string;
  systemTypes?: string | null;
  visitsPerMonth?: number;
  frequency?: Frequency;
  targetMonths?: string | null;
  preferredDays?: string | null;
  active?: boolean;
}

const VALID_PROF_ID = 'cabcdefghijklmnopqrstuvwx';

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
    active: o.active ?? true,
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

interface RunResult {
  status: number;
  responseBody: any;
  appointments: Array<{
    clientId: string;
    professionalId: string;
    contractId: string;
    date: Date;
    type: 'VISITA_TECNICA' | 'TESTE_SDAI';
    observation?: string;
  }>;
  deleteManyArgs: any;
}

async function runGenerate(body: any = { professionalId: VALID_PROF_ID, year: 2027 }): Promise<RunResult> {
  const req = new Request('http://localhost/api/schedule/generate', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
  const response = await POST(req);
  const responseBody = await response.json();

  const createCall = prismaMock.appointment.createMany.mock.calls[0];
  const appointments = createCall ? ((createCall[0] as any).data as any[]) : [];

  const deleteCall = prismaMock.appointment.deleteMany.mock.calls[0];
  const deleteManyArgs = deleteCall ? deleteCall[0] : null;

  return { status: response.status, responseBody, appointments, deleteManyArgs };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockReset(prismaMock);
  mockGetServerSession.mockResolvedValue({ user: { name: 'Admin' } });
  prismaMock.holiday.findMany.mockResolvedValue([]);
  prismaMock.appointment.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.appointment.createMany.mockResolvedValue({ count: 0 });
  // $transaction é chamado com callback — executa callback com prismaMock como tx
  prismaMock.$transaction.mockImplementation(async (cb: any) => cb(prismaMock));
});

// ---------------------------------------------------------------------------
// Auth & Validation
// ---------------------------------------------------------------------------

describe('POST /api/schedule/generate — auth & validation', () => {
  it('retorna 401 sem sessão', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const { status } = await runGenerate();
    expect(status).toBe(401);
  });

  it('retorna 400 quando professionalId está ausente', async () => {
    const { status } = await runGenerate({ year: 2027 });
    expect(status).toBe(400);
  });

  it('retorna 400 quando professionalId não bate com regex cuid', async () => {
    const { status } = await runGenerate({ professionalId: 'invalid-id', year: 2027 });
    expect(status).toBe(400);
  });

  it('retorna 400 para ano fora do intervalo permitido', async () => {
    const { status: s1 } = await runGenerate({ professionalId: VALID_PROF_ID, year: 2019 });
    const { status: s2 } = await runGenerate({ professionalId: VALID_PROF_ID, year: 2101 });
    expect(s1).toBe(400);
    expect(s2).toBe(400);
  });

  it('usa ano corrente quando year é omitido', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'ANNUAL', systemTypes: 'CFTV' }]) as any,
    );
    const { status, appointments } = await runGenerate({ professionalId: VALID_PROF_ID });
    expect(status).toBe(201);
    const currentYear = new Date().getFullYear();
    appointments.forEach((a) => {
      expect(a.date.getUTCFullYear()).toBe(currentYear);
    });
  });
});

// ---------------------------------------------------------------------------
// Professional / Contracts not found
// ---------------------------------------------------------------------------

describe('POST /api/schedule/generate — estado inválido', () => {
  it('retorna 404 quando técnico não existe', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(null);
    const { status } = await runGenerate();
    expect(status).toBe(404);
  });

  it('retorna 404 quando técnico não tem contratos', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([]) as any,
    );
    const { status } = await runGenerate();
    expect(status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Transação atômica + persistência
// ---------------------------------------------------------------------------

describe('POST /api/schedule/generate — persistência', () => {
  it('deleta tudo do técnico OU dos contratos antes de criar', async () => {
    const prof = makeProfessional([{ frequency: 'ANNUAL', systemTypes: 'CFTV' }]);
    prismaMock.professional.findUnique.mockResolvedValue(prof as any);

    const { deleteManyArgs } = await runGenerate();

    expect(prismaMock.$transaction).toHaveBeenCalled();
    expect(prismaMock.appointment.deleteMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.appointment.createMany).toHaveBeenCalledTimes(1);
    expect(deleteManyArgs.where.OR).toContainEqual({ professionalId: prof.id });
    expect(deleteManyArgs.where.OR).toContainEqual({
      contractId: { in: prof.contracts.map((c: any) => c.id) },
    });
  });

  it('retorna 201 com contagem e mensagem', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 1 }]) as any,
    );
    const { status, responseBody } = await runGenerate();
    expect(status).toBe(201);
    expect(responseBody).toHaveProperty('count');
    expect(responseBody).toHaveProperty('contractCount');
    expect(responseBody).toHaveProperty('message');
  });
});

// ---------------------------------------------------------------------------
// SDAI behavior
// ---------------------------------------------------------------------------

describe('POST /api/schedule/generate — SDAI', () => {
  it('gera TESTE_SDAI para contrato MONTHLY com SDAI em systemTypes', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'SDAI,CFTV', visitsPerMonth: 2 }]) as any,
    );
    const { appointments } = await runGenerate();
    const sdai = appointments.filter((a) => a.type === 'TESTE_SDAI');
    expect(sdai.length).toBe(4); // trimestral
  });

  it('NÃO gera TESTE_SDAI quando systemTypes não inclui SDAI', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'CFTV,SAP', visitsPerMonth: 2 }]) as any,
    );
    const { appointments } = await runGenerate();
    expect(appointments.filter((a) => a.type === 'TESTE_SDAI')).toHaveLength(0);
  });

  it('NÃO gera TESTE_SDAI automático para contrato não-MONTHLY', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'BIMONTHLY', systemTypes: 'SDAI,CFTV', visitsPerMonth: 2 }]) as any,
    );
    const { appointments } = await runGenerate();
    expect(appointments.filter((a) => a.type === 'TESTE_SDAI')).toHaveLength(0);
  });

  it('TESTE_SDAI tem observation "Teste Geral SDAI (Trimestral)"', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 }]) as any,
    );
    const { appointments } = await runGenerate();
    const sdai = appointments.filter((a) => a.type === 'TESTE_SDAI');
    sdai.forEach((a) => expect(a.observation).toBe('Teste Geral SDAI (Trimestral)'));
  });

  it('coloca TESTE_SDAI em sábados (quando não há feriado no sábado)', async () => {
    // 2027 não tem feriado nacional nos sábados do grupo 0 (jan/abr/jul/out)
    // Jan 2027 sábados: 2, 9, 16, 23, 30 — nenhum é feriado
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 }]) as any,
    );
    const { appointments } = await runGenerate({ professionalId: VALID_PROF_ID, year: 2027 });
    const sdai = appointments.filter((a) => a.type === 'TESTE_SDAI');
    expect(sdai.length).toBe(4);
    sdai.forEach((a) => expect(a.date.getUTCDay()).toBe(6)); // 6 = sábado
  });

  it('escolhe qualquer sábado disponível (sem preferência de dia específico)', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 }]) as any,
    );
    const { appointments } = await runGenerate({ professionalId: VALID_PROF_ID, year: 2027 });
    const sdai = appointments.filter((a) => a.type === 'TESTE_SDAI');
    // Contrato precisa estar em 4 meses (trimestral). Todas datas distintas e em sábado.
    expect(sdai).toHaveLength(4);
    sdai.forEach((a) => expect(a.date.getUTCDay()).toBe(6));
    const keys = sdai.map((a) => a.date.toISOString().split('T')[0]);
    expect(new Set(keys).size).toBe(4);
  });

  it('não marca dois SDAI no mesmo sábado mesmo com contratos no mesmo grupo de rotação', async () => {
    // 4 contratos: idx 0 e idx 3 caem no mesmo grupo (idx % 3 === 0), mesmos meses.
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([
        { frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 },
        { frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 },
        { frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 },
        { frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 },
      ]) as any,
    );
    const { appointments } = await runGenerate({ professionalId: VALID_PROF_ID, year: 2027 });
    const sdai = appointments.filter((a) => a.type === 'TESTE_SDAI');
    const keys = sdai.map((a) => a.date.toISOString().split('T')[0]);
    expect(new Set(keys).size).toBe(keys.length); // nenhuma data repetida
  });

  it('mantém folga maior que 7 dias entre SDAI no mesmo mês (pula sábado adjacente)', async () => {
    // 2 contratos no mesmo grupo de rotação → 2 testes/mês em certos meses.
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([
        { frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 },
        { frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 },
        { frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 },
        { frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 },
      ]) as any,
    );
    const { appointments } = await runGenerate({ professionalId: VALID_PROF_ID, year: 2027 });

    const sdaiByMonth = new Map<number, number[]>();
    appointments
      .filter((a) => a.type === 'TESTE_SDAI')
      .forEach((a) => {
        const m = a.date.getUTCMonth();
        const arr = sdaiByMonth.get(m) ?? [];
        arr.push(a.date.getTime());
        sdaiByMonth.set(m, arr);
      });

    const MS_PER_DAY = 1000 * 60 * 60 * 24;
    sdaiByMonth.forEach((times) => {
      if (times.length < 2) return;
      times.sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) {
        const gapDays = (times[i] - times[i - 1]) / MS_PER_DAY;
        expect(gapDays).toBeGreaterThan(7);
      }
    });
  });

  it('distribui múltiplos contratos SDAI em grupos de rotação (idx % 3)', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([
        { frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 },
        { frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 },
        { frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 1 },
      ]) as any,
    );
    const { appointments } = await runGenerate({ professionalId: VALID_PROF_ID, year: 2027 });
    const sdaiByContract = new Map<string, number[]>();
    appointments
      .filter((a) => a.type === 'TESTE_SDAI')
      .forEach((a) => {
        const arr = sdaiByContract.get(a.contractId) ?? [];
        arr.push(a.date.getUTCMonth());
        sdaiByContract.set(a.contractId, arr);
      });
    const months = Array.from(sdaiByContract.values()).map((ms) => ms.sort((a, b) => a - b));
    // Grupo 0: meses 0,3,6,9 | Grupo 1: 1,4,7,10 | Grupo 2: 2,5,8,11
    expect(months).toContainEqual([0, 3, 6, 9]);
    expect(months).toContainEqual([1, 4, 7, 10]);
    expect(months).toContainEqual([2, 5, 8, 11]);
  });
});

// ---------------------------------------------------------------------------
// Frequência / meses ativos
// ---------------------------------------------------------------------------

describe('POST /api/schedule/generate — frequências', () => {
  it('MONTHLY visitsPerMonth=2 sem SDAI = 24 visitas/ano', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 2 }]) as any,
    );
    const { appointments } = await runGenerate();
    const visits = appointments.filter((a) => a.type === 'VISITA_TECNICA');
    expect(visits.length).toBe(24);
  });

  it('MONTHLY visitsPerMonth=2 COM SDAI = 20 visitas + 4 testes', async () => {
    // 12 meses*2=24, menos 1 por mês SDAI (4 meses) = 20 visitas
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'SDAI', visitsPerMonth: 2 }]) as any,
    );
    const { appointments } = await runGenerate();
    const visits = appointments.filter((a) => a.type === 'VISITA_TECNICA');
    const tests = appointments.filter((a) => a.type === 'TESTE_SDAI');
    expect(visits.length).toBe(20);
    expect(tests.length).toBe(4);
  });

  it('BIMONTHLY = 6 visitas/ano (1 a cada 2 meses)', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'BIMONTHLY', systemTypes: 'CFTV' }]) as any,
    );
    const { appointments } = await runGenerate();
    const visits = appointments.filter((a) => a.type === 'VISITA_TECNICA');
    expect(visits.length).toBe(6);
  });

  it('QUARTERLY = 4 visitas/ano', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'QUARTERLY', systemTypes: 'CFTV' }]) as any,
    );
    const { appointments } = await runGenerate();
    const visits = appointments.filter((a) => a.type === 'VISITA_TECNICA');
    expect(visits.length).toBe(4);
  });

  it('SEMIANNUAL = 2 visitas/ano', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'SEMIANNUAL', systemTypes: 'CFTV' }]) as any,
    );
    const { appointments } = await runGenerate();
    const visits = appointments.filter((a) => a.type === 'VISITA_TECNICA');
    expect(visits.length).toBe(2);
  });

  it('ANNUAL = 1 visita/ano', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'ANNUAL', systemTypes: 'CFTV' }]) as any,
    );
    const { appointments } = await runGenerate();
    const visits = appointments.filter((a) => a.type === 'VISITA_TECNICA');
    expect(visits.length).toBe(1);
  });

  it('targetMonths="0,6" força visitas só em Jan e Jul', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([
        { frequency: 'SEMIANNUAL', systemTypes: 'CFTV', targetMonths: '0,6' },
      ]) as any,
    );
    const { appointments } = await runGenerate();
    const visits = appointments.filter((a) => a.type === 'VISITA_TECNICA');
    expect(visits.length).toBe(2);
    const months = visits.map((v) => v.date.getUTCMonth()).sort((a, b) => a - b);
    expect(months).toEqual([0, 6]);
  });

  it('visitsPerMonth=0 não gera visitas', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([
        { frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 0 },
      ]) as any,
    );
    const { appointments } = await runGenerate();
    expect(appointments.filter((a) => a.type === 'VISITA_TECNICA')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Exclusões: fins de semana e feriados
// ---------------------------------------------------------------------------

describe('POST /api/schedule/generate — exclusões', () => {
  it('visitas técnicas nunca caem em sábado ou domingo', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 2 }]) as any,
    );
    const { appointments } = await runGenerate();
    appointments
      .filter((a) => a.type === 'VISITA_TECNICA')
      .forEach((a) => {
        const dow = a.date.getUTCDay();
        expect(dow).toBeGreaterThanOrEqual(1);
        expect(dow).toBeLessThanOrEqual(5);
      });
  });

  it('visitas técnicas nunca caem em feriados nacionais fixos', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 2 }]) as any,
    );
    const { appointments } = await runGenerate({ professionalId: VALID_PROF_ID, year: 2027 });
    const fixedHolidayKeys = new Set([
      '2027-01-01',
      '2027-01-25',
      '2027-04-21',
      '2027-05-01',
      '2027-07-09',
      '2027-09-07',
      '2027-10-12',
      '2027-11-02',
      '2027-11-15',
      '2027-11-20',
      '2027-12-25',
    ]);
    appointments.forEach((a) => {
      const key = a.date.toISOString().split('T')[0];
      expect(fixedHolidayKeys.has(key)).toBe(false);
    });
  });

  it('respeita feriados customizados vindos do banco', async () => {
    const customHoliday = { id: 'h1', date: new Date('2027-03-17'), name: 'Custom', fixed: false };
    prismaMock.holiday.findMany.mockResolvedValue([customHoliday] as any);
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 2 }]) as any,
    );
    const { appointments } = await runGenerate({ professionalId: VALID_PROF_ID, year: 2027 });
    appointments.forEach((a) => {
      expect(a.date.toISOString().split('T')[0]).not.toBe('2027-03-17');
    });
  });
});

// ---------------------------------------------------------------------------
// preferredDays
// ---------------------------------------------------------------------------

describe('POST /api/schedule/generate — preferredDays', () => {
  it('quando preferredDays="1" (segunda), maioria cai em segunda', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([
        { frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 1, preferredDays: '1' },
      ]) as any,
    );
    const { appointments } = await runGenerate();
    const mondays = appointments
      .filter((a) => a.type === 'VISITA_TECNICA')
      .filter((a) => a.date.getUTCDay() === 1).length;
    // 1 visita/mês * 12 = 12. Sem conflitos, todas caem em segunda (peso 0 vs 1000).
    expect(mondays).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// Numeração cronológica
// ---------------------------------------------------------------------------

describe('POST /api/schedule/generate — numeração', () => {
  it('visitas são renumeradas em ordem cronológica por contrato', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([{ frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 1 }]) as any,
    );
    const { appointments } = await runGenerate();
    const visits = appointments
      .filter((a) => a.type === 'VISITA_TECNICA')
      .sort((a, b) => a.date.getTime() - b.date.getTime());
    visits.forEach((v, i) => {
      expect(v.observation).toBe(`Visita ${(i + 1).toString().padStart(2, '0')}`);
    });
  });

  it('numeração reinicia em 01 para cada contrato', async () => {
    prismaMock.professional.findUnique.mockResolvedValue(
      makeProfessional([
        { frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 1 },
        { frequency: 'MONTHLY', systemTypes: 'CFTV', visitsPerMonth: 1 },
      ]) as any,
    );
    const { appointments } = await runGenerate();
    const byContract = new Map<string, string[]>();
    appointments
      .filter((a) => a.type === 'VISITA_TECNICA')
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .forEach((a) => {
        const arr = byContract.get(a.contractId) ?? [];
        arr.push(a.observation ?? '');
        byContract.set(a.contractId, arr);
      });
    byContract.forEach((obs) => {
      expect(obs[0]).toBe('Visita 01');
    });
  });
});
