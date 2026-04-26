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

import { DELETE as DELETE_CLIENT, PUT as PUT_CLIENT } from '@/app/api/clients/[id]/route';
import { GET, POST } from '@/app/api/clients/route';
import prisma from '@/lib/prisma';

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

beforeEach(() => {
  mockReset(prismaMock);
  mockGetServerSession.mockResolvedValue({ user: { id: 'user-1', name: 'Admin' } });
  prismaMock.auditLog.create.mockResolvedValue({} as any);
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockClient = {
  id: 'cltest000000000000000000000',
  name: 'Edificio Centro',
  phone: '(11) 91234-5678',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  contracts: [
    {
      id: 'clcontract00000000000000001',
      visitsPerMonth: 2,
      frequency: 'MONTHLY',
      targetMonths: null,
      systemTypes: null,
      preferredDays: null,
      professionalId: null,
      professional: null,
      clientId: 'cltest000000000000000000000',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ],
};

const validClientBody = {
  name: 'Shopping Central',
  phone: '(11) 99999-8888',
  visitsPerMonth: 4,
  frequency: 'MONTHLY',
  targetMonths: 'Jan,Feb',
  systemTypes: 'CFTV',
  preferredDays: 'Mon,Wed',
  // professionalId is optional — omit rather than pass null (schema rejects null)
};

const filteredUser = {
  user: {
    id: 'supervisor-1',
    name: 'Supervisor',
    role: 'Supervisor',
    internalContactId: 'contact-1',
  },
};

// ---------------------------------------------------------------------------
// GET /api/clients
// ---------------------------------------------------------------------------
describe('GET /api/clients', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const response = await GET(new Request('http://localhost/api/clients'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns a list of clients with contracts on success', async () => {
    prismaMock.client.findMany.mockResolvedValue([mockClient] as any);

    const response = await GET(new Request('http://localhost/api/clients'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Edificio Centro');
    expect(body[0]).toHaveProperty('contracts');
  });

  it('returns an empty array when no clients exist', async () => {
    prismaMock.client.findMany.mockResolvedValue([]);

    const response = await GET(new Request('http://localhost/api/clients'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([]);
  });

  it('returns 500 when Prisma throws', async () => {
    prismaMock.client.findMany.mockRejectedValue(new Error('DB error'));

    const response = await GET(new Request('http://localhost/api/clients'));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// POST /api/clients
// ---------------------------------------------------------------------------
describe('POST /api/clients', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/clients', {
      method: 'POST',
      body: JSON.stringify(validClientBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(401);
  });

  it('creates a client and returns 201 with the created record', async () => {
    const createdClient = { ...mockClient, name: 'Shopping Central' };
    prismaMock.client.create.mockResolvedValue(createdClient as any);

    const req = new Request('http://localhost/api/clients', {
      method: 'POST',
      body: JSON.stringify(validClientBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.name).toBe('Shopping Central');
  });

  it('returns 403 when filtered user assigns a professional outside their scope', async () => {
    mockGetServerSession.mockResolvedValueOnce(filteredUser);
    prismaMock.professional.findMany.mockResolvedValue([{ id: 'other-professional' }] as any);

    const req = new Request('http://localhost/api/clients', {
      method: 'POST',
      body: JSON.stringify({
        ...validClientBody,
        professionalId: 'clprof00000000000000000001',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(403);
    expect(prismaMock.client.create).not.toHaveBeenCalled();
  });

  it('capitalizes the client name before storing', async () => {
    (prismaMock.client.create as any).mockImplementation(async ({ data }: any) => ({
      ...mockClient,
      name: data.name,
      contracts: [{ ...mockClient.contracts[0] }],
    }));

    const req = new Request('http://localhost/api/clients', {
      method: 'POST',
      body: JSON.stringify({ ...validClientBody, name: 'shopping central da cidade' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);
    const body = await response.json();

    // ApiUtils.capitalizeName: "da" is a preposition → stays lowercase
    expect(body.name).toBe('Shopping Central da Cidade');
  });

  it('accepts visitsPerMonth as a string and coerces to number', async () => {
    (prismaMock.client.create as any).mockImplementation(async ({ data }: any) => ({
      ...mockClient,
      contracts: [
        {
          ...mockClient.contracts[0],
          visitsPerMonth: data.contracts.create.visitsPerMonth,
        },
      ],
    }));

    const req = new Request('http://localhost/api/clients', {
      method: 'POST',
      body: JSON.stringify({ ...validClientBody, visitsPerMonth: '3' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const createCall = prismaMock.client.create.mock.calls[0][0] as any;
    expect(typeof createCall.data.contracts.create.visitsPerMonth).toBe('number');
    expect(createCall.data.contracts.create.visitsPerMonth).toBe(3);
  });

  it('returns 400 when name is too short', async () => {
    const req = new Request('http://localhost/api/clients', {
      method: 'POST',
      body: JSON.stringify({ ...validClientBody, name: 'A' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when frequency is an invalid enum value', async () => {
    const req = new Request('http://localhost/api/clients', {
      method: 'POST',
      body: JSON.stringify({ ...validClientBody, frequency: 'WEEKLY' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when required fields are missing', async () => {
    const req = new Request('http://localhost/api/clients', {
      method: 'POST',
      body: JSON.stringify({ phone: '(11) 99999-0000' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it('returns 500 when Prisma create throws', async () => {
    prismaMock.client.create.mockRejectedValue(new Error('Unique constraint failed'));

    const req = new Request('http://localhost/api/clients', {
      method: 'POST',
      body: JSON.stringify(validClientBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('stores null for optional fields when omitted', async () => {
    (prismaMock.client.create as any).mockImplementation(async ({ data }: any) => ({
      ...mockClient,
      phone: data.phone,
      contracts: [
        {
          ...mockClient.contracts[0],
          targetMonths: data.contracts.create.targetMonths,
          systemTypes: data.contracts.create.systemTypes,
          professionalId: data.contracts.create.professionalId,
        },
      ],
    }));

    const minimalBody = {
      name: 'Condominio Minimo',
      visitsPerMonth: 1,
      frequency: 'MONTHLY',
    };

    const req = new Request('http://localhost/api/clients', {
      method: 'POST',
      body: JSON.stringify(minimalBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const createCall = prismaMock.client.create.mock.calls[0][0] as any;
    expect(createCall.data.phone).toBeNull();
    expect(createCall.data.contracts.create.professionalId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PUT /api/clients/[id]
// ---------------------------------------------------------------------------
describe('PUT /api/clients/[id]', () => {
  const validClientId = 'cabcdefghijklmnopqrstuvwx';

  it('returns 403 when filtered user edits a client outside their scope', async () => {
    mockGetServerSession.mockResolvedValueOnce(filteredUser);
    prismaMock.professional.findMany.mockResolvedValue([{ id: 'other-professional' }] as any);
    prismaMock.client.findFirst.mockResolvedValue(null);

    const req = new Request(`http://localhost/api/clients/${validClientId}`, {
      method: 'PUT',
      body: JSON.stringify(validClientBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT_CLIENT(req, { params: Promise.resolve({ id: validClientId }) });

    expect(response.status).toBe(403);
    expect(prismaMock.client.update).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/clients/[id]
// ---------------------------------------------------------------------------
describe('DELETE /api/clients/[id]', () => {
  const validClientId = 'cabcdefghijklmnopqrstuvwx';

  it('deletes a client and writes CLIENT_DELETED audit log', async () => {
    const existing = { ...mockClient, id: validClientId };
    prismaMock.client.findUnique.mockResolvedValue(existing as any);
    prismaMock.client.delete.mockResolvedValue(existing as any);

    const req = new Request(`http://localhost/api/clients/${validClientId}`, {
      method: 'DELETE',
    });

    const response = await DELETE_CLIENT(req, { params: Promise.resolve({ id: validClientId }) });

    expect(response.status).toBe(200);
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        actorLabel: 'Admin',
        action: 'CLIENT_DELETED',
        entityType: 'CLIENT',
        entityId: validClientId,
        entityLabel: existing.name,
      }),
    });
  });

  it('returns 403 when filtered user deletes a client outside their scope', async () => {
    mockGetServerSession.mockResolvedValueOnce(filteredUser);
    prismaMock.professional.findMany.mockResolvedValue([{ id: 'other-professional' }] as any);
    prismaMock.client.findFirst.mockResolvedValue(null);

    const req = new Request(`http://localhost/api/clients/${validClientId}`, {
      method: 'DELETE',
    });

    const response = await DELETE_CLIENT(req, { params: Promise.resolve({ id: validClientId }) });

    expect(response.status).toBe(403);
    expect(prismaMock.client.delete).not.toHaveBeenCalled();
  });

  it('audit log failure does not fail client deletion', async () => {
    const existing = { ...mockClient, id: validClientId };
    prismaMock.client.findUnique.mockResolvedValue(existing as any);
    prismaMock.client.delete.mockResolvedValue(existing as any);
    prismaMock.auditLog.create.mockRejectedValueOnce(new Error('audit unavailable'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const req = new Request(`http://localhost/api/clients/${validClientId}`, {
      method: 'DELETE',
    });

    const response = await DELETE_CLIENT(req, { params: Promise.resolve({ id: validClientId }) });

    expect(response.status).toBe(200);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[AuditLog]'), expect.any(Error));
    errSpy.mockRestore();
  });
});
