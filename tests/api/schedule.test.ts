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
  mockGetServerSession.mockResolvedValue({ user: { id: 'user-1', name: 'Admin' } });
  prismaMock.auditLog.create.mockResolvedValue({} as any);
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

const filteredUser = {
  user: {
    id: 'supervisor-1',
    name: 'Supervisor',
    role: 'Supervisor',
    internalContactId: 'contact-1',
  },
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

  it('returns 403 when filtered user schedules outside their scope', async () => {
    mockGetServerSession.mockResolvedValueOnce(filteredUser);
    prismaMock.professional.findMany.mockResolvedValue([{ id: 'other-professional' }] as any);

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify(validScheduleBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(403);
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it('returns 403 when filtered user schedules a client outside their scope', async () => {
    mockGetServerSession.mockResolvedValueOnce(filteredUser);
    prismaMock.professional.findMany.mockResolvedValue([
      { id: validScheduleBody.professionalId },
    ] as any);
    prismaMock.client.findFirst.mockResolvedValue(null);

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify(validScheduleBody),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(403);
    expect(prismaMock.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: validScheduleBody.clientId }),
      }),
    );
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it('returns 400 when contract does not belong to the informed client', async () => {
    prismaMock.contract.findUnique.mockResolvedValue({
      clientId: 'cbbbbbbbbbbbbbbbbbbbbbbbb',
      professionalId: validScheduleBody.professionalId,
    } as any);

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify({ ...validScheduleBody, contractId: 'ccontract0000000000000000' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it('returns 400 when contract does not belong to the informed professional', async () => {
    prismaMock.contract.findUnique.mockResolvedValue({
      clientId: validScheduleBody.clientId,
      professionalId: 'cbbbbbbbbbbbbbbbbbbbbbbbb',
    } as any);

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify({ ...validScheduleBody, contractId: 'ccontract0000000000000000' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
  });

  it('returns 400 when contract has no professional assigned', async () => {
    prismaMock.contract.findUnique.mockResolvedValue({
      clientId: validScheduleBody.clientId,
      professionalId: null,
    } as any);

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify({ ...validScheduleBody, contractId: 'ccontract0000000000000000' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await POST(req);

    expect(response.status).toBe(400);
    expect(prismaMock.appointment.create).not.toHaveBeenCalled();
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

  it('renumera visitas do contrato ao criar VISITA_TECNICA sem observation custom', async () => {
    const contractId = 'clcontract000000000000001';
    prismaMock.contract.findUnique.mockResolvedValue({
      clientId: validScheduleBody.clientId,
      professionalId: validScheduleBody.professionalId,
    } as any);
    prismaMock.appointment.create.mockResolvedValue({
      ...mockAppointment,
      contractId,
      type: 'VISITA_TECNICA',
      date: new Date('2024-06-15T10:00:00.000Z'),
    } as any);
    prismaMock.appointment.findMany.mockResolvedValue([] as any);

    const { observation: _obs, ...bodyWithoutObs } = validScheduleBody;
    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify({ ...bodyWithoutObs, contractId }),
      headers: { 'Content-Type': 'application/json' },
    });

    await POST(req);

    expect(prismaMock.appointment.findMany).toHaveBeenCalledWith({
      where: {
        contractId,
        type: 'VISITA_TECNICA',
        date: {
          gte: new Date(Date.UTC(2024, 0, 1)),
          lt: new Date(Date.UTC(2025, 0, 1)),
        },
      },
      orderBy: { date: 'asc' },
      select: { id: true, observation: true },
    });
  });

  it('não renumera ao criar visita com observation customizada (respeita input)', async () => {
    const contractId = 'clcontract000000000000001';
    prismaMock.contract.findUnique.mockResolvedValue({
      clientId: validScheduleBody.clientId,
      professionalId: validScheduleBody.professionalId,
    } as any);
    prismaMock.appointment.create.mockResolvedValue({
      ...mockAppointment,
      contractId,
      type: 'VISITA_TECNICA',
      observation: 'Reunião especial',
    } as any);

    const req = new Request('http://localhost/api/schedule', {
      method: 'POST',
      body: JSON.stringify({
        ...validScheduleBody,
        contractId,
        observation: 'Reunião especial',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await POST(req);

    expect(prismaMock.appointment.findMany).not.toHaveBeenCalled();
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

    const response = await DELETE(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(401);
  });

  it('deletes an appointment and returns { success: true }', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...mockAppointment,
      client: { name: 'Cliente Teste' },
    } as any);
    prismaMock.appointment.delete.mockResolvedValue(mockAppointment as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ success: true });
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        actorLabel: 'Admin',
        action: 'APPOINTMENT_DELETED',
        entityType: 'APPOINTMENT',
        entityId: validId,
        entityLabel: 'Cliente Teste',
      }),
    });
  });

  it('calls prisma.appointment.delete with the correct id', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(mockAppointment as any);
    prismaMock.appointment.delete.mockResolvedValue(mockAppointment as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'DELETE',
    });

    await DELETE(req, { params: Promise.resolve({ id: validId }) });

    expect(prismaMock.appointment.delete).toHaveBeenCalledWith({
      where: { id: validId },
    });
  });

  it('returns 403 when filtered user deletes outside their scope', async () => {
    mockGetServerSession.mockResolvedValueOnce(filteredUser);
    prismaMock.appointment.findUnique.mockResolvedValue(mockAppointment as any);
    prismaMock.professional.findMany.mockResolvedValue([{ id: 'other-professional' }] as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(403);
    expect(prismaMock.appointment.delete).not.toHaveBeenCalled();
  });

  it('returns 404 when appointment does not exist', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(null);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when id does not match CUID pattern', async () => {
    const req = new Request('http://localhost/api/schedule/invalid-id', {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: 'invalid-id' }) });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when id is an empty string', async () => {
    const req = new Request('http://localhost/api/schedule/', {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: '' }) });

    expect(response.status).toBe(400);
  });

  it('returns 500 when Prisma delete throws', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(mockAppointment as any);
    prismaMock.appointment.delete.mockRejectedValue(new Error('DB error'));

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'DELETE',
    });

    const response = await DELETE(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('renumera visitas restantes do contrato no mesmo ano após deletar VISITA_TECNICA', async () => {
    const contractId = 'clcontract000000000000001';
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...mockAppointment,
      contractId,
      type: 'VISITA_TECNICA',
      date: new Date('2026-05-12T00:00:00.000Z'),
      client: { name: 'HL Faria Lima' },
    } as any);
    prismaMock.appointment.delete.mockResolvedValue(mockAppointment as any);
    prismaMock.appointment.findMany.mockResolvedValue([
      { id: 'apt1', observation: 'Visita 07' },
      { id: 'apt2', observation: 'Visita 08' },
    ] as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'DELETE',
    });

    await DELETE(req, { params: Promise.resolve({ id: validId }) });

    expect(prismaMock.appointment.findMany).toHaveBeenCalledWith({
      where: {
        contractId,
        type: 'VISITA_TECNICA',
        date: {
          gte: new Date(Date.UTC(2026, 0, 1)),
          lt: new Date(Date.UTC(2027, 0, 1)),
        },
      },
      orderBy: { date: 'asc' },
      select: { id: true, observation: true },
    });
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });

  it('não renumera ao deletar TESTE_SDAI (mantém observation original do teste)', async () => {
    const contractId = 'clcontract000000000000001';
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...mockAppointment,
      contractId,
      type: 'TESTE_SDAI',
      client: { name: 'HL Faria Lima' },
    } as any);
    prismaMock.appointment.delete.mockResolvedValue(mockAppointment as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'DELETE',
    });

    await DELETE(req, { params: Promise.resolve({ id: validId }) });

    expect(prismaMock.appointment.findMany).not.toHaveBeenCalled();
  });

  it('não renumera ao deletar appointment sem contractId', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...mockAppointment,
      contractId: null,
      type: 'VISITA_TECNICA',
      client: { name: 'Avulso' },
    } as any);
    prismaMock.appointment.delete.mockResolvedValue(mockAppointment as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'DELETE',
    });

    await DELETE(req, { params: Promise.resolve({ id: validId }) });

    expect(prismaMock.appointment.findMany).not.toHaveBeenCalled();
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

    const response = await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(401);
  });

  it('updates observation and returns 200', async () => {
    const updated = { ...mockAppointment, observation: 'Updated observation' };
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...mockAppointment,
      client: { name: 'Cliente Teste' },
    } as any);
    prismaMock.appointment.update.mockResolvedValue(updated as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'Updated observation' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.observation).toBe('Updated observation');
  });

  it('updates type to TESTE_SDAI', async () => {
    const updated = { ...mockAppointment, type: 'TESTE_SDAI' };
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...mockAppointment,
      client: { name: 'Cliente Teste' },
    } as any);
    prismaMock.appointment.update.mockResolvedValue(updated as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ type: 'TESTE_SDAI' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.type).toBe('TESTE_SDAI');
  });

  it('updates date and converts it to a Date object', async () => {
    const newDate = '2024-08-20T09:00:00.000Z';
    const updated = { ...mockAppointment, date: new Date(newDate) };
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...mockAppointment,
      client: { name: 'Cliente Teste' },
    } as any);
    prismaMock.appointment.update.mockResolvedValue(updated as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ date: newDate }),
      headers: { 'Content-Type': 'application/json' },
    });

    await PATCH(req, { params: Promise.resolve({ id: validId }) });

    const updateCall = prismaMock.appointment.update.mock.calls[0][0] as any;
    expect(updateCall.data.date).toBeInstanceOf(Date);
  });

  it('allows patch date in YYYY-MM-DD format used by the calendar UI', async () => {
    const updated = { ...mockAppointment, date: new Date('2024-08-20T00:00:00.000Z') };
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...mockAppointment,
      client: { name: 'Cliente Teste' },
    } as any);
    prismaMock.appointment.update.mockResolvedValue(updated as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ date: '2024-08-20' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(200);
  });

  it('only includes defined fields in the update payload', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...mockAppointment,
      client: { name: 'Cliente Teste' },
    } as any);
    prismaMock.appointment.update.mockResolvedValue(mockAppointment as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'Only this' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await PATCH(req, { params: Promise.resolve({ id: validId }) });

    const updateCall = prismaMock.appointment.update.mock.calls[0][0] as any;
    expect(updateCall.data).toHaveProperty('observation', 'Only this');
    expect(updateCall.data).not.toHaveProperty('type');
    expect(updateCall.data).not.toHaveProperty('date');
  });

  it('returns 403 when filtered user patches outside their scope', async () => {
    mockGetServerSession.mockResolvedValueOnce(filteredUser);
    prismaMock.appointment.findUnique.mockResolvedValue(mockAppointment as any);
    prismaMock.professional.findMany.mockResolvedValue([{ id: 'other-professional' }] as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'Blocked' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(403);
    expect(prismaMock.appointment.update).not.toHaveBeenCalled();
  });

  it('returns 404 when appointment does not exist', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue(null);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'x' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(404);
  });

  it('grava APPOINTMENT_UPDATED no audit quando altera data/tipo/observação', async () => {
    const before = {
      ...mockAppointment,
      date: new Date('2026-04-24T00:00:00.000Z'),
      type: 'VISITA_TECNICA',
      observation: 'Visita 01',
      client: { name: 'Edifício Alfa' },
    };
    const after = {
      ...mockAppointment,
      date: new Date('2026-04-25T00:00:00.000Z'),
      type: 'TESTE_SDAI',
      observation: 'Remarcado',
    };
    prismaMock.appointment.findUnique.mockResolvedValue(before as any);
    prismaMock.appointment.update.mockResolvedValue(after as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        date: '2026-04-25T00:00:00.000Z',
        type: 'TESTE_SDAI',
        observation: 'Remarcado',
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1);
    const logCall = prismaMock.auditLog.create.mock.calls[0][0] as any;
    expect(logCall.data).toMatchObject({
      userId: 'user-1',
      actorLabel: 'Admin',
      action: 'APPOINTMENT_UPDATED',
      entityType: 'APPOINTMENT',
      entityId: validId,
      entityLabel: 'Edifício Alfa',
    });
    const metadata = JSON.parse(logCall.data.metadataJson);
    expect(metadata.before).toEqual({
      date: '2026-04-24T00:00:00.000Z',
      type: 'VISITA_TECNICA',
      observation: 'Visita 01',
    });
    expect(metadata.after).toEqual({
      date: '2026-04-25T00:00:00.000Z',
      type: 'TESTE_SDAI',
      observation: 'Remarcado',
    });
  });

  it('não grava audit quando nenhum campo relevante mudou', async () => {
    const same = {
      ...mockAppointment,
      date: new Date('2026-04-24T00:00:00.000Z'),
      type: 'VISITA_TECNICA',
      observation: 'Visita 01',
      client: { name: 'Edifício Alfa' },
    };
    prismaMock.appointment.findUnique.mockResolvedValue(same as any);
    prismaMock.appointment.update.mockResolvedValue(same as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'Visita 01' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it('falha no audit não derruba o PATCH', async () => {
    const before = {
      ...mockAppointment,
      observation: 'Antes',
      client: { name: 'Edifício Alfa' },
    };
    const after = { ...mockAppointment, observation: 'Depois' };
    prismaMock.appointment.findUnique.mockResolvedValue(before as any);
    prismaMock.appointment.update.mockResolvedValue(after as any);
    prismaMock.auditLog.create.mockRejectedValueOnce(new Error('DB offline'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'Depois' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(200);
    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining('[AuditLog]'), expect.any(Error));
    errSpy.mockRestore();
  });

  it('returns 400 when id does not match CUID pattern', async () => {
    const req = new Request('http://localhost/api/schedule/bad-id', {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: Promise.resolve({ id: 'bad-id' }) });

    expect(response.status).toBe(400);
  });

  it('returns 400 when type has an invalid enum value', async () => {
    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ type: 'INVALID_TYPE' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('returns 400 when patch date is not parseable', async () => {
    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ date: 'not-a-date' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(400);
    expect(prismaMock.appointment.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.appointment.update).not.toHaveBeenCalled();
  });

  it('returns 400 when patch date is parseable but not an ISO-like date', async () => {
    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ date: '1' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(400);
    expect(prismaMock.appointment.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.appointment.update).not.toHaveBeenCalled();
  });

  it('returns 400 when observation exceeds 500 characters', async () => {
    const longObs = 'x'.repeat(501);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: longObs }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(400);
  });

  it('returns 500 when Prisma update throws', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...mockAppointment,
      client: { name: 'Cliente Teste' },
    } as any);
    prismaMock.appointment.update.mockRejectedValue(new Error('Record not found'));

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('VISITA→SDAI sem observation: reescreve para "Teste Geral SDAI (Trimestral)"', async () => {
    const contractId = 'clcontract000000000000001';
    const before = {
      ...mockAppointment,
      contractId,
      type: 'VISITA_TECNICA',
      observation: 'Visita 07',
      date: new Date('2026-07-22T00:00:00.000Z'),
      client: { name: 'Praça Pamplona' },
    };
    prismaMock.appointment.findUnique.mockResolvedValue(before as any);
    prismaMock.appointment.update.mockResolvedValue({
      ...before,
      type: 'TESTE_SDAI',
      observation: 'Teste Geral SDAI (Trimestral)',
    } as any);
    prismaMock.appointment.findMany.mockResolvedValue([] as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ type: 'TESTE_SDAI' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await PATCH(req, { params: Promise.resolve({ id: validId }) });

    const updateCall = prismaMock.appointment.update.mock.calls[0][0] as any;
    expect(updateCall.data.observation).toBe('Teste Geral SDAI (Trimestral)');
    // Mudança de tipo também dispara renumeração (visita "sumiu" do count)
    expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ contractId, type: 'VISITA_TECNICA' }),
      }),
    );
  });

  it('SDAI→VISITA sem observation: zera observation e renumeração dá "Visita NN"', async () => {
    const contractId = 'clcontract000000000000001';
    const before = {
      ...mockAppointment,
      contractId,
      type: 'TESTE_SDAI',
      observation: 'Teste Geral SDAI (Trimestral)',
      date: new Date('2026-07-22T00:00:00.000Z'),
      client: { name: 'Praça Pamplona' },
    };
    prismaMock.appointment.findUnique.mockResolvedValue(before as any);
    prismaMock.appointment.update.mockResolvedValue({
      ...before,
      type: 'VISITA_TECNICA',
      observation: '',
    } as any);
    prismaMock.appointment.findMany.mockResolvedValue([] as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ type: 'VISITA_TECNICA' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await PATCH(req, { params: Promise.resolve({ id: validId }) });

    const updateCall = prismaMock.appointment.update.mock.calls[0][0] as any;
    expect(updateCall.data.observation).toBe('');
    expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ contractId, type: 'VISITA_TECNICA' }),
      }),
    );
  });

  it('mudança de tipo com observation custom no body: respeita o input', async () => {
    const contractId = 'clcontract000000000000001';
    const before = {
      ...mockAppointment,
      contractId,
      type: 'VISITA_TECNICA',
      observation: 'Visita 07',
      date: new Date('2026-07-22T00:00:00.000Z'),
      client: { name: 'Praça Pamplona' },
    };
    prismaMock.appointment.findUnique.mockResolvedValue(before as any);
    prismaMock.appointment.update.mockResolvedValue({
      ...before,
      type: 'TESTE_SDAI',
      observation: 'Reagendado',
    } as any);
    prismaMock.appointment.findMany.mockResolvedValue([] as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ type: 'TESTE_SDAI', observation: 'Reagendado' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await PATCH(req, { params: Promise.resolve({ id: validId }) });

    const updateCall = prismaMock.appointment.update.mock.calls[0][0] as any;
    expect(updateCall.data.observation).toBe('Reagendado');
  });

  it('PATCH só de observation (sem tipo) não dispara renumeração', async () => {
    prismaMock.appointment.findUnique.mockResolvedValue({
      ...mockAppointment,
      contractId: 'clcontract000000000000001',
      type: 'VISITA_TECNICA',
      observation: 'Antiga',
      client: { name: 'X' },
    } as any);
    prismaMock.appointment.update.mockResolvedValue({
      ...mockAppointment,
      contractId: 'clcontract000000000000001',
      observation: 'Atualizada',
    } as any);

    const req = new Request(`http://localhost/api/schedule/${validId}`, {
      method: 'PATCH',
      body: JSON.stringify({ observation: 'Atualizada' }),
      headers: { 'Content-Type': 'application/json' },
    });

    await PATCH(req, { params: Promise.resolve({ id: validId }) });

    expect(prismaMock.appointment.findMany).not.toHaveBeenCalled();
  });
});
