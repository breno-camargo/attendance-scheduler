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

import { GET, POST } from '@/app/api/professionals/route';
import prisma from '@/lib/prisma';

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

beforeEach(() => {
  mockReset(prismaMock);
  mockGetServerSession.mockResolvedValue({ user: { name: 'Admin' } });
  delete process.env.EMAIL_DOMAIN;
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockProfessional = {
  id: 'clprof00000000000000000001',
  name: 'Carlos Silva',
  email: 'carlos@compasss.com.br',
  phone: '(11) 91234-5678',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const validProfessionalBody = {
  name: 'Carlos Silva',
  email: 'carlos@compasss.com.br',
  phone: '(11) 91234-5678',
};

// ---------------------------------------------------------------------------
// GET /api/professionals
// ---------------------------------------------------------------------------
describe('GET /api/professionals', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const response = await GET(new Request('http://localhost/api/professionals'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns a list of professionals on success', async () => {
    prismaMock.professional.findMany.mockResolvedValue([mockProfessional] as any);

    const response = await GET(new Request('http://localhost/api/professionals'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Carlos Silva');
    expect(body[0].email).toBe('c****@compasss.com.br');
  });

  it('returns an empty array when no professionals exist', async () => {
    prismaMock.professional.findMany.mockResolvedValue([]);

    const response = await GET(new Request('http://localhost/api/professionals'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([]);
  });

  it('returns 500 when Prisma throws', async () => {
    prismaMock.professional.findMany.mockRejectedValue(new Error('DB unavailable'));

    const response = await GET(new Request('http://localhost/api/professionals'));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// POST /api/professionals
// ---------------------------------------------------------------------------
describe('POST /api/professionals', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/professionals', {
      method: 'POST',
      body: JSON.stringify(validProfessionalBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(401);
  });

  it('creates a professional and returns 201', async () => {
    prismaMock.professional.create.mockResolvedValue(mockProfessional as any);

    const req = new Request('http://localhost/api/professionals', {
      method: 'POST',
      body: JSON.stringify(validProfessionalBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.name).toBe('Carlos Silva');
    expect(body.email).toBe('carlos@compasss.com.br');
  });

  it('stores a full email as-is without appending a domain', async () => {
    // @ts-expect-error — simplified mock return doesn't match full Prisma client type
    prismaMock.professional.create.mockImplementation(async ({ data }: any) => ({
      ...mockProfessional,
      email: data.email,
    }));

    const req = new Request('http://localhost/api/professionals', {
      method: 'POST',
      body: JSON.stringify({ name: 'Carlos Silva', email: 'carlos@compasss.com.br', phone: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const createCall = prismaMock.professional.create.mock.calls[0][0] as any;
    expect(createCall.data.email).toBe('carlos@compasss.com.br');
  });

  it('uses EMAIL_DOMAIN env var domain when set (full email stored correctly)', async () => {
    // @ts-expect-error — simplified mock return doesn't match full Prisma client type
    prismaMock.professional.create.mockImplementation(async ({ data }: any) => ({
      ...mockProfessional,
      email: data.email,
    }));

    process.env.EMAIL_DOMAIN = 'minha-empresa.com.br';

    const req = new Request('http://localhost/api/professionals', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ana Souza', email: 'ana@minha-empresa.com.br', phone: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const createCall = prismaMock.professional.create.mock.calls[0][0] as any;
    expect(createCall.data.email).toBe('ana@minha-empresa.com.br');
  });

  it('capitalizes the professional name correctly (prepositions stay lowercase)', async () => {
    // @ts-expect-error — simplified mock return doesn't match full Prisma client type
    prismaMock.professional.create.mockImplementation(async ({ data }: any) => ({
      ...mockProfessional,
      name: data.name,
    }));

    const req = new Request('http://localhost/api/professionals', {
      method: 'POST',
      body: JSON.stringify({ ...validProfessionalBody, name: 'carlos silva de souza' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.name).toBe('Carlos Silva de Souza');
  });

  it('capitalizes names with multiple prepositions', async () => {
    // @ts-expect-error — simplified mock return doesn't match full Prisma client type
    prismaMock.professional.create.mockImplementation(async ({ data }: any) => ({
      ...mockProfessional,
      name: data.name,
    }));

    const req = new Request('http://localhost/api/professionals', {
      method: 'POST',
      body: JSON.stringify({ ...validProfessionalBody, name: 'joao da silva dos santos' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    const body = await response.json();
    expect(body.name).toBe('Joao da Silva dos Santos');
  });

  it('returns 400 when name is missing', async () => {
    const req = new Request('http://localhost/api/professionals', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@compasss.com.br', phone: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when name is too short (less than 2 chars)', async () => {
    const req = new Request('http://localhost/api/professionals', {
      method: 'POST',
      body: JSON.stringify({ name: 'A', email: 'a@compasss.com.br', phone: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it('returns 400 when email format is invalid', async () => {
    const req = new Request('http://localhost/api/professionals', {
      method: 'POST',
      body: JSON.stringify({ name: 'Carlos Silva', email: 'not-an-email', phone: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when email is empty string', async () => {
    const req = new Request('http://localhost/api/professionals', {
      method: 'POST',
      body: JSON.stringify({ name: 'Carlos Silva', email: '', phone: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it('stores null for optional phone when not provided', async () => {
    // @ts-expect-error — simplified mock return doesn't match full Prisma client type
    prismaMock.professional.create.mockImplementation(async ({ data }: any) => ({
      ...mockProfessional,
      phone: data.phone,
    }));

    const req = new Request('http://localhost/api/professionals', {
      method: 'POST',
      body: JSON.stringify({ name: 'Carlos Silva', email: 'carlos@compasss.com.br' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const createCall = prismaMock.professional.create.mock.calls[0][0] as any;
    expect(createCall.data.phone).toBeNull();
  });

  it('returns 500 when Prisma create throws', async () => {
    prismaMock.professional.create.mockRejectedValue(new Error('Unique constraint on email'));

    const req = new Request('http://localhost/api/professionals', {
      method: 'POST',
      body: JSON.stringify(validProfessionalBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});
