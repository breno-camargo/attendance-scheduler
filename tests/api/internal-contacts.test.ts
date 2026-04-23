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

import { PUT, DELETE } from '@/app/api/internal-contacts/[id]/route';
import { GET, POST } from '@/app/api/internal-contacts/route';
import prisma from '@/lib/prisma';

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

beforeEach(() => {
  mockReset(prismaMock);
  mockGetServerSession.mockResolvedValue({ user: { name: 'Admin' } });
  // Mock $transaction to execute the callback with prismaMock as the transaction client
  prismaMock.$transaction.mockImplementation((cb: (tx: typeof prismaMock) => Promise<unknown>) =>
    cb(prismaMock),
  );
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
// Valid CUID-like id matching /^c[a-z0-9]{24}$/
const validId = 'cabcdefghijklmnopqrstuvwx';

const mockContact = {
  id: validId,
  name: 'Maria Oliveira',
  role: 'Supervisor',
  phone: '(11) 91234-5678',
  email: 'maria@compasss.com.br',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const validContactBody = {
  name: 'Maria Oliveira',
  role: 'Supervisor',
  phone: '(11) 91234-5678',
  email: 'maria@compasss.com.br',
};

// ---------------------------------------------------------------------------
// GET /api/internal-contacts
// ---------------------------------------------------------------------------
describe('GET /api/internal-contacts', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const response = await GET(new Request('http://localhost/api/internal-contacts'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns a list of internal contacts on success', async () => {
    prismaMock.internalContact.findMany.mockResolvedValue([mockContact] as any);

    const response = await GET(new Request('http://localhost/api/internal-contacts'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Maria Oliveira');
    expect(body[0].role).toBe('Supervisor');
  });

  it('returns an empty array when no contacts exist', async () => {
    prismaMock.internalContact.findMany.mockResolvedValue([]);

    const response = await GET(new Request('http://localhost/api/internal-contacts'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual([]);
  });

  it('returns 500 when Prisma throws', async () => {
    prismaMock.internalContact.findMany.mockRejectedValue(new Error('DB error'));

    const response = await GET(new Request('http://localhost/api/internal-contacts'));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// POST /api/internal-contacts
// ---------------------------------------------------------------------------
describe('POST /api/internal-contacts', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/internal-contacts', {
      method: 'POST',
      body: JSON.stringify(validContactBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(401);
  });

  it('creates a contact and returns 201', async () => {
    prismaMock.internalContact.findFirst.mockResolvedValue(null);
    prismaMock.internalContact.create.mockResolvedValue(mockContact as any);

    const req = new Request('http://localhost/api/internal-contacts', {
      method: 'POST',
      body: JSON.stringify(validContactBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.name).toBe('Maria Oliveira');
    expect(body.role).toBe('Supervisor');
  });

  it('capitalizes the contact name correctly', async () => {
    prismaMock.internalContact.findFirst.mockResolvedValue(null);
    // @ts-expect-error — simplified mock return doesn't match full Prisma client type
    prismaMock.internalContact.create.mockImplementation(async ({ data }: any) => ({
      ...mockContact,
      name: data.name,
    }));

    const req = new Request('http://localhost/api/internal-contacts', {
      method: 'POST',
      body: JSON.stringify({ ...validContactBody, name: 'maria de oliveira' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.name).toBe('Maria de Oliveira');
  });

  it('returns 400 when a UNIQUE_ROLES role (Supervisor) is already taken', async () => {
    prismaMock.internalContact.findFirst.mockResolvedValue({
      ...mockContact,
      id: 'cdifferentid0000000000001',
      name: 'Ana Silva',
    } as any);

    const req = new Request('http://localhost/api/internal-contacts', {
      method: 'POST',
      body: JSON.stringify({ ...validContactBody, role: 'Supervisor' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Supervisor');
  });

  it('returns 400 when the Gerente role is already taken and error names the holder', async () => {
    prismaMock.internalContact.findFirst.mockResolvedValue({
      ...mockContact,
      role: 'Gerente',
      name: 'Pedro Costa',
    } as any);

    const req = new Request('http://localhost/api/internal-contacts', {
      method: 'POST',
      body: JSON.stringify({ ...validContactBody, role: 'Gerente' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Gerente');
    expect(body.error).toContain('Pedro Costa');
  });

  it('allows non-unique roles without calling findFirst', async () => {
    prismaMock.internalContact.create.mockResolvedValue({
      ...mockContact,
      role: 'Tecnico',
    } as any);

    const req = new Request('http://localhost/api/internal-contacts', {
      method: 'POST',
      body: JSON.stringify({ ...validContactBody, role: 'Tecnico' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    expect(prismaMock.internalContact.findFirst).not.toHaveBeenCalled();
  });

  it('returns 400 when name is missing', async () => {
    const { name: _n, ...body } = validContactBody;

    const req = new Request('http://localhost/api/internal-contacts', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    const resBody = await response.json();
    expect(resBody).toHaveProperty('error');
  });

  it('stores null for optional fields when not provided', async () => {
    // @ts-expect-error — simplified mock return doesn't match full Prisma client type
    prismaMock.internalContact.create.mockImplementation(async ({ data }: any) => ({
      ...mockContact,
      role: data.role,
      phone: data.phone,
      email: data.email,
    }));

    const req = new Request('http://localhost/api/internal-contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Carlos Minimo' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const createCall = prismaMock.internalContact.create.mock.calls[0][0] as any;
    expect(createCall.data.role).toBeNull();
    expect(createCall.data.phone).toBeNull();
    expect(createCall.data.email).toBeNull();
  });

  it('returns 500 when Prisma create throws', async () => {
    prismaMock.internalContact.findFirst.mockResolvedValue(null);
    prismaMock.internalContact.create.mockRejectedValue(new Error('DB error'));

    const req = new Request('http://localhost/api/internal-contacts', {
      method: 'POST',
      body: JSON.stringify(validContactBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/internal-contacts/[id]
// ---------------------------------------------------------------------------
describe('PUT /api/internal-contacts/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const req = new Request(`http://localhost/api/internal-contacts/${validId}`, {
      method: 'PUT',
      body: JSON.stringify(validContactBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(401);
  });

  it('updates a contact and returns 200', async () => {
    prismaMock.internalContact.findFirst.mockResolvedValue(null);
    prismaMock.internalContact.update.mockResolvedValue(mockContact as any);

    const req = new Request(`http://localhost/api/internal-contacts/${validId}`, {
      method: 'PUT',
      body: JSON.stringify(validContactBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe('Maria Oliveira');
  });

  it('capitalizes the name when updating', async () => {
    prismaMock.internalContact.findFirst.mockResolvedValue(null);
    // @ts-expect-error — simplified mock return doesn't match full Prisma client type
    prismaMock.internalContact.update.mockImplementation(async ({ data }: any) => ({
      ...mockContact,
      name: data.name,
    }));

    const req = new Request(`http://localhost/api/internal-contacts/${validId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...validContactBody, name: 'joao dos santos' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.name).toBe('Joao dos Santos');
  });

  it('returns 400 when updating to a UNIQUE role already held by another contact', async () => {
    prismaMock.internalContact.findFirst.mockResolvedValue({
      ...mockContact,
      id: 'cdifferentid0000000000099',
      name: 'Outro Supervisor',
    } as any);

    const req = new Request(`http://localhost/api/internal-contacts/${validId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...validContactBody, role: 'Supervisor' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain('Supervisor');
  });

  it('allows updating own unique role (self excluded from conflict check)', async () => {
    // findFirst returns null because the only Supervisor IS this contact
    // (excluded by `id: { not: params.id }`)
    prismaMock.internalContact.findFirst.mockResolvedValue(null);
    prismaMock.internalContact.update.mockResolvedValue(mockContact as any);

    const req = new Request(`http://localhost/api/internal-contacts/${validId}`, {
      method: 'PUT',
      body: JSON.stringify({ ...validContactBody, role: 'Supervisor' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(200);
    expect(prismaMock.internalContact.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: validId } }),
      }),
    );
  });

  it('returns 400 when id does not match CUID pattern', async () => {
    const req = new Request('http://localhost/api/internal-contacts/bad-id', {
      method: 'PUT',
      body: JSON.stringify(validContactBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(req, { params: Promise.resolve({ id: 'bad-id' }) });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when name is missing', async () => {
    const { name: _n, ...bodyWithoutName } = validContactBody;

    const req = new Request(`http://localhost/api/internal-contacts/${validId}`, {
      method: 'PUT',
      body: JSON.stringify(bodyWithoutName),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(400);
  });

  it('returns 500 when Prisma update throws', async () => {
    prismaMock.internalContact.findFirst.mockResolvedValue(null);
    prismaMock.internalContact.update.mockRejectedValue(new Error('Record not found'));

    const req = new Request(`http://localhost/api/internal-contacts/${validId}`, {
      method: 'PUT',
      body: JSON.stringify(validContactBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PUT(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/internal-contacts/[id]
// ---------------------------------------------------------------------------
describe('DELETE /api/internal-contacts/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const req = new Request(`http://localhost/api/internal-contacts/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(401);
  });

  it('deletes a contact and returns { success: true }', async () => {
    prismaMock.internalContact.delete.mockResolvedValue(mockContact as any);

    const req = new Request(`http://localhost/api/internal-contacts/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });
  });

  it('calls prisma.internalContact.delete with the correct id', async () => {
    prismaMock.internalContact.delete.mockResolvedValue(mockContact as any);

    const req = new Request(`http://localhost/api/internal-contacts/${validId}`, {
      method: 'DELETE',
    });

    await DELETE(req, { params: Promise.resolve({ id: validId }) });

    expect(prismaMock.internalContact.delete).toHaveBeenCalledWith({
      where: { id: validId },
    });
  });

  it('returns 400 when id does not match CUID pattern', async () => {
    const req = new Request('http://localhost/api/internal-contacts/not-a-cuid', {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: 'not-a-cuid' }) });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when id is empty string', async () => {
    const req = new Request('http://localhost/api/internal-contacts/', {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: '' }) });

    expect(response.status).toBe(400);
  });

  it('returns 500 when Prisma delete throws (record not found)', async () => {
    prismaMock.internalContact.delete.mockRejectedValue(new Error('Record not found'));

    const req = new Request(`http://localhost/api/internal-contacts/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});
