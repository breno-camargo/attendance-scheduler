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

import { DELETE, PATCH } from '@/app/api/schedule/[id]/route';
import { POST } from '@/app/api/schedule/route';
import prisma from '@/lib/prisma';

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

beforeEach(() => {
  mockReset(prismaMock);
  mockGetServerSession.mockResolvedValue({ user: { name: 'Admin' } });
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
// Valid CUID-like id that matches /^c[a-z0-9]{24}$/
const validId = 'cabcdefghijklmnopqrstuvwx';

const mockAppointment = {
  id: validId,
  clientId: 'clclient00000000000000001',
  professionalId: 'clprof00000000000000000001',
  contractId: null,
  date: new Date('2024-06-15'),
  type: 'VISITA_TECNICA',
  observation: '',
  status: 'SCHEDULED',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const validScheduleBody = {
  clientId: 'clclient00000000000000001',
  professionalId: 'clprof00000000000000000001',
  contractId: null,
  date: '2024-06-15T10:00:00.000Z',
  type: 'VISITA_TECNICA',
  observation: 'Check elevators',
};

// ---------------------------------------------------------------------------
// POST /api/schedule
// ---------------------------------------------------------------------------
describe('POST /api/schedule', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify(validScheduleBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(401);
  });

  it('creates an appointment and returns 201', async () => {
    prismaMock.appointment.create.mockResolvedValue(mockAppointment as any);

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify(validScheduleBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.type).toBe('VISITA_TECNICA');
  });

  it('defaults type to VISITA_TECNICA when not provided', async () => {
    prismaMock.appointment.create.mockResolvedValue(mockAppointment as any);

    // Omit type — schema defaults to VISITA_TECNICA
    const { type: _t, ...bodyWithoutType } = validScheduleBody;
    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify(bodyWithoutType),
      headers: { 'Content-Type': 'application/json' },
    });

    await POST(req);

    const createCall = prismaMock.appointment.create.mock.calls[0][0] as any;
    expect(createCall.data.type).toBe('VISITA_TECNICA');
  });

  it('creates an appointment with TESTE_SDAI type', async () => {
    const sdaiAppointment = { ...mockAppointment, type: 'TESTE_SDAI' };
    prismaMock.appointment.create.mockResolvedValue(sdaiAppointment as any);

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify({ ...validScheduleBody, type: 'TESTE_SDAI' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.type).toBe('TESTE_SDAI');
  });

  it('converts date string to a Date object before storing', async () => {
    prismaMock.appointment.create.mockResolvedValue(mockAppointment as any);

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify(validScheduleBody),
      headers: { 'Content-Type': 'application/json' },
    });

    await POST(req);

    const createCall = prismaMock.appointment.create.mock.calls[0][0] as any;
    expect(createCall.data.date).toBeInstanceOf(Date);
  });

  it('defaults observation to empty string when omitted', async () => {
    prismaMock.appointment.create.mockResolvedValue(mockAppointment as any);

    const { observation: _obs, ...bodyWithoutObs } = validScheduleBody;
    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify(bodyWithoutObs),
      headers: { 'Content-Type': 'application/json' },
    });

    await POST(req);

    const createCall = prismaMock.appointment.create.mock.calls[0][0] as any;
    expect(createCall.data.observation).toBe('');
  });

  it('returns 400 when clientId is missing', async () => {
    const { clientId: _c, ...body } = validScheduleBody;

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    const resBody = await response.json();
    expect(resBody).toHaveProperty('error');
  });

  it('returns 400 when professionalId is missing', async () => {
    const { professionalId: _p, ...body } = validScheduleBody;

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it('returns 400 when date is missing', async () => {
    const { date: _d, ...body } = validScheduleBody;

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it('returns 400 when date string is not parseable', async () => {
    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify({ ...validScheduleBody, date: 'not-a-date' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it('returns 400 when type is an invalid enum value', async () => {
    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify({ ...validScheduleBody, type: 'REUNIAO' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
  });

  it('returns 500 when Prisma create throws', async () => {
    prismaMock.appointment.create.mockRejectedValue(new Error('Foreign key constraint'));

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify(validScheduleBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/schedule/[id]
// ---------------------------------------------------------------------------
describe('DELETE /api/schedule/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: { id: validId } });

    expect(response.status).toBe(401);
  });

  it('deletes an appointment and returns { success: true }', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(mockAppointment as any);
    prismaMock.appointment.delete.mockResolvedValue(mockAppointment as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: { id: validId } });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });
  });

  it('calls prisma.appointment.delete with the correct id', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(mockAppointment as any);
    prismaMock.appointment.delete.mockResolvedValue(mockAppointment as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'DELETE',
    });

    await DELETE(req, { params: { id: validId } });

    expect(prismaMock.appointment.delete).toHaveBeenCalledWith({
      where: { id: validId },
    });
  });

  it('returns 404 when appointment does not exist', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(null);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: { id: validId } });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when id does not match CUID pattern', async () => {
    const req = new Request('http://localhost/api/schedule/invalid-id', {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: { id: 'invalid-id' } });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when id is an empty string', async () => {
    const req = new Request('http://localhost/api/schedule/', {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: { id: '' } });

    expect(response.status).toBe(400);
  });

  it('returns 500 when Prisma delete throws', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(mockAppointment as any);
    prismaMock.appointment.delete.mockRejectedValue(new Error('DB error'));

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: { id: validId } });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/schedule/[id]
// ---------------------------------------------------------------------------
describe('PATCH /api/schedule/[id]', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'Updated observation' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: { id: validId } });

    expect(response.status).toBe(401);
  });

  it('updates observation and returns 200', async () => {
    const updated = { ...mockAppointment, observation: 'Updated observation' };
    prismaMock.appointment.update.mockResolvedValue(updated as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'Updated observation' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: { id: validId } });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.observation).toBe('Updated observation');
  });

  it('updates type to TESTE_SDAI', async () => {
    const updated = { ...mockAppointment, type: 'TESTE_SDAI' };
    prismaMock.appointment.update.mockResolvedValue(updated as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ type: 'TESTE_SDAI' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: { id: validId } });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe('TESTE_SDAI');
  });

  it('updates date and converts it to a Date object', async () => {
    const newDate = '2024-08-20T09:00:00.000Z';
    const updated = { ...mockAppointment, date: new Date(newDate) };
    prismaMock.appointment.update.mockResolvedValue(updated as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ date: newDate }),
      headers: { 'Content-Type': 'application/json' },
    });

    await PATCH(req, { params: { id: validId } });

    const updateCall = prismaMock.appointment.update.mock.calls[0][0] as any;
    expect(updateCall.data.date).toBeInstanceOf(Date);
  });

  it('only includes defined fields in the update payload', async () => {
    prismaMock.appointment.update.mockResolvedValue(mockAppointment as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'Only this' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await PATCH(req, { params: { id: validId } });

    const updateCall = prismaMock.appointment.update.mock.calls[0][0] as any;
    expect(updateCall.data).toHaveProperty('observation', 'Only this');
    expect(updateCall.data).not.toHaveProperty('type');
    expect(updateCall.data).not.toHaveProperty('date');
  });

  it('returns 400 when id does not match CUID pattern', async () => {
    const req = new Request('http://localhost/api/schedule/bad-id', {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: { id: 'bad-id' } });

    expect(response.status).toBe(400);
  });

  it('returns 400 when type has an invalid enum value', async () => {
    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ type: 'INVALID_TYPE' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: { id: validId } });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when observation exceeds 500 characters', async () => {
    const longObs = 'x'.repeat(501);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: longObs }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: { id: validId } });

    expect(response.status).toBe(400);
  });

  it('returns 500 when Prisma update throws', async () => {
    prismaMock.appointment.update.mockRejectedValue(new Error('Record not found'));

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: { id: validId } });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });
});
