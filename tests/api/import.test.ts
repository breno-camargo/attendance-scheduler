import type { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { mockDeep } from 'vitest-mock-extended';
import { mockReset } from 'vitest-mock-extended';

const excelMock = vi.hoisted(() => ({
  worksheets: [] as any[],
}));

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

const mockCheckImportRateLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  checkImportRateLimit: (...args: any[]) => mockCheckImportRateLimit(...args),
}));

const mockAudit = vi.fn();
vi.mock('@/lib/audit', () => ({ audit: (...args: any[]) => mockAudit(...args) }));

vi.mock('exceljs', () => ({
  default: {
    Workbook: vi.fn(function Workbook() {
      return {
        xlsx: { load: vi.fn().mockResolvedValue(undefined) },
        get worksheets() {
          return excelMock.worksheets;
        },
      };
    }),
  },
}));

import { POST } from '@/app/api/import/route';
import prisma from '@/lib/prisma';

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function makeRequest(file: any = makeFile()) {
  return {
    headers: new Headers(),
    formData: vi.fn(async () => ({
      get: (key: string) => (key === 'file' ? file : null),
    })),
  } as any as Request;
}

function makeFile(overrides: Partial<File> = {}) {
  return {
    name: 'clientes.xlsx',
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 1024,
    arrayBuffer: vi.fn(async () => new ArrayBuffer(8)),
    ...overrides,
  } as any as File;
}

function makeSheet(rowCount: number) {
  return {
    rowCount,
    getRow(rowNumber: number) {
      if (rowNumber === 1) {
        return {
          eachCell: (_opts: unknown, cb: (cell: { value: string }, col: number) => void) => {
            cb({ value: 'Cliente' }, 1);
          },
        };
      }
      return {
        getCell: () => ({ value: `Cliente ${rowNumber}` }),
      };
    },
  };
}

const adminSession = { user: { id: 'admin-1', name: 'Admin' } };
const filteredSession = {
  user: {
    id: 'supervisor-1',
    name: 'Supervisor',
    role: 'Supervisor',
    internalContactId: 'contact-1',
  },
};

beforeEach(() => {
  mockReset(prismaMock);
  vi.clearAllMocks();
  excelMock.worksheets = [];
  mockGetServerSession.mockResolvedValue(adminSession);
  mockCheckImportRateLimit.mockResolvedValue(true);
});

describe('POST /api/import', () => {
  it('retorna 401 sem sessão', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
  });

  it('bloqueia usuários com escopo filtrado', async () => {
    mockGetServerSession.mockResolvedValueOnce(filteredSession);
    const request = makeRequest();

    const response = await POST(request);

    expect(response.status).toBe(403);
    expect(request.formData).not.toHaveBeenCalled();
  });

  it('aplica rate limit antes de processar o arquivo', async () => {
    mockCheckImportRateLimit.mockResolvedValueOnce(false);
    const request = makeRequest();

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(mockCheckImportRateLimit).toHaveBeenCalledWith('admin-1');
    expect(request.formData).not.toHaveBeenCalled();
  });

  it('rejeita planilhas acima do limite de linhas', async () => {
    excelMock.worksheets = [makeSheet(502)];

    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Máximo permitido: 500 linhas');
    expect(prismaMock.client.createMany).not.toHaveBeenCalled();
    expect(prismaMock.contract.createMany).not.toHaveBeenCalled();
  });
});
