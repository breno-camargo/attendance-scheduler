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

import { DELETE } from '@/app/api/holidays/[id]/route';
import { GET, POST } from '@/app/api/holidays/route';
import prisma from '@/lib/prisma';

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

beforeEach(() => {
  mockReset(prismaMock);
  mockGetServerSession.mockResolvedValue({ user: { name: 'Admin' } });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const mockHoliday = {
  id: 'clholiday0000000000000001',
  date: new Date('2024-12-25'),
  name: 'Natal',
};

// ---------------------------------------------------------------------------
// GET /api/holidays
// ---------------------------------------------------------------------------
describe('GET /api/holidays', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const response = await GET(new Request('http://localhost/api/holidays'));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns a list of holidays ordered by date (fixed + custom)', async () => {
    prismaMock.holiday.findMany.mockResolvedValue([mockHoliday] as any);

    const response = await GET(new Request('http://localhost/api/holidays?year=2024'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    // Includes fixed holidays + 1 custom
    expect(body.length).toBeGreaterThan(1);
    expect(body.some((h: any) => h.name === 'Natal')).toBe(true);
    expect(body.some((h: any) => h.fixed === true)).toBe(true);
  });

  it('returns only fixed holidays when there are no custom ones', async () => {
    prismaMock.holiday.findMany.mockResolvedValue([]);

    const response = await GET(new Request('http://localhost/api/holidays?year=2024'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((h: any) => h.fixed === true)).toBe(true);
  });

  it('returns 500 when Prisma throws', async () => {
    prismaMock.holiday.findMany.mockRejectedValue(new Error('DB error'));

    const response = await GET(new Request('http://localhost/api/holidays'));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('calls findMany with correct select and orderBy options', async () => {
    prismaMock.holiday.findMany.mockResolvedValue([]);

    await GET(new Request('http://localhost/api/holidays'));

    expect(prismaMock.holiday.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, date: true, name: true, fixed: true },
        orderBy: { date: 'asc' },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/holidays
// ---------------------------------------------------------------------------
describe('POST /api/holidays', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/holidays', {
      method: 'POST',
      body: JSON.stringify({ date: '2024-12-25', name: 'Natal' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(401);
  });

  it('creates a holiday and returns 201', async () => {
    prismaMock.holiday.create.mockResolvedValue(mockHoliday as any);

    const req = new Request('http://localhost/api/holidays', {
      method: 'POST',
      body: JSON.stringify({ date: '2024-12-25', name: 'Natal' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.name).toBe('Natal');
  });

  it('converts date string to a Date object before storing', async () => {
    prismaMock.holiday.create.mockResolvedValue(mockHoliday as any);

    const req = new Request('http://localhost/api/holidays', {
      method: 'POST',
      body: JSON.stringify({ date: '2024-04-21', name: 'Tiradentes' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await POST(req);

    const createCall = prismaMock.holiday.create.mock.calls[0][0] as any;
    expect(createCall.data.date).toBeInstanceOf(Date);
    expect(createCall.data.name).toBe('Tiradentes');
  });

  it('returns 500 when Prisma create throws', async () => {
    prismaMock.holiday.create.mockRejectedValue(new Error('Constraint violation'));

    const req = new Request('http://localhost/api/holidays', {
      method: 'POST',
      body: JSON.stringify({ date: '2024-12-25', name: 'Natal' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/holidays/[id]
// ---------------------------------------------------------------------------
describe('DELETE /api/holidays/[id]', () => {
  const validId = 'clholiday0000000000000001';

  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const req = new Request(`http://localhost/api/holidays/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: validId }) } as any);

    expect(response.status).toBe(401);
  });

  it('deletes a non-fixed holiday and returns { deleted: true }', async () => {
    prismaMock.holiday.findUnique.mockResolvedValue({ ...mockHoliday, fixed: false } as any);
    prismaMock.holiday.delete.mockResolvedValue(mockHoliday as any);

    const req = new Request(`http://localhost/api/holidays/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: validId }) } as any);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ deleted: true });
  });

  it('calls prisma.holiday.delete with the correct id', async () => {
    prismaMock.holiday.findUnique.mockResolvedValue({ ...mockHoliday, fixed: false } as any);
    prismaMock.holiday.delete.mockResolvedValue(mockHoliday as any);

    const req = new Request(`http://localhost/api/holidays/${validId}`, {
      method: 'DELETE',
    });

    await DELETE(req, { params: Promise.resolve({ id: validId }) } as any);

    expect(prismaMock.holiday.delete).toHaveBeenCalledWith({
      where: { id: validId },
    });
  });

  it('returns 404 when holiday does not exist', async () => {
    prismaMock.holiday.findUnique.mockResolvedValue(null);

    const req = new Request(`http://localhost/api/holidays/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: validId }) } as any);

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 403 when trying to delete a fixed holiday', async () => {
    prismaMock.holiday.findUnique.mockResolvedValue({ ...mockHoliday, fixed: true } as any);

    const req = new Request(`http://localhost/api/holidays/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: validId }) } as any);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toContain('fixos');
  });

  it('returns 500 when Prisma delete throws', async () => {
    prismaMock.holiday.findUnique.mockResolvedValue({ ...mockHoliday, fixed: false } as any);
    prismaMock.holiday.delete.mockRejectedValue(new Error('DB error'));

    const req = new Request(`http://localhost/api/holidays/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: validId }) } as any);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});
